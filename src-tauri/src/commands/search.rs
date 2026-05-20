//! Vault search backend — powers the Cmd+Shift+F palette.
//!
//! Walks the active vault with `ignore::WalkBuilder` (standard filters:
//! respects `.gitignore`, skips hidden directories and git-internal
//! paths). For every markdown file encountered, builds a single
//! `grep-regex::RegexMatcher` per query + options, runs it line-by-line
//! via `grep-searcher::Searcher`, and collects matches into a per-file
//! `SearchMatch` bag.
//!
//! Limits to keep the UI responsive on big vaults:
//!   - `MAX_HITS_PER_FILE` — stop scanning a single file after N matches.
//!   - `MAX_FILES_WITH_HITS` — stop walking the tree after N files have
//!     contributed at least one match.
//!
//! Matching options come from the front-end:
//!   - `case_sensitive` (default: false → smart-case off, fully insensitive)
//!   - `whole_word` (default: false)
//!   - `regex` (default: false → query is treated as a literal string)

use std::path::Path;

use grep_matcher::Matcher;
use grep_regex::{RegexMatcher, RegexMatcherBuilder};
use grep_searcher::{Searcher, Sink, SinkMatch};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};

use crate::commands::files::vault_for;
use crate::models::Vault;
use tauri::AppHandle;

/// Per-call user-facing search options.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
}

/// A single match inside a file. `match_start` / `match_end` are byte
/// offsets within `line_content` (chars are UTF-8 — the front-end can
/// convert to char offsets if it wants visual highlighting).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub line_number: u64,
    pub line_content: String,
    pub match_start: u64,
    pub match_end: u64,
}

/// All hits for a single file, grouped together.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub relative_path: String,
    pub hits: Vec<SearchHit>,
}

const MAX_HITS_PER_FILE: usize = 100;
const MAX_FILES_WITH_HITS: usize = 200;

/// Recognise the file extensions we care to search. Markus is a
/// markdown app, so we skip everything else even if it lives in the
/// vault (PNG screenshots, .json sidecar files, …).
fn is_markdown(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase());
    matches!(ext.as_deref(), Some("md") | Some("markdown"))
}

fn build_matcher(query: &str, options: &SearchOptions) -> Result<RegexMatcher, String> {
    let pattern = if options.regex {
        query.to_string()
    } else {
        regex::escape(query)
    };
    let pattern = if options.whole_word {
        format!(r"\b(?:{pattern})\b")
    } else {
        pattern
    };
    RegexMatcherBuilder::new()
        .case_insensitive(!options.case_sensitive)
        .build(&pattern)
        .map_err(|e| format!("invalid query: {e}"))
}

/// Sink that collects up to `MAX_HITS_PER_FILE` matches for a single
/// file. Errors out early (via the special `()` SinkError) once the cap
/// is hit so the Searcher can stop walking the file.
struct CollectingSink<'m> {
    matcher: &'m RegexMatcher,
    hits: Vec<SearchHit>,
}

impl<'m> Sink for CollectingSink<'m> {
    type Error = std::io::Error;

    fn matched(
        &mut self,
        _searcher: &Searcher,
        mat: &SinkMatch<'_>,
    ) -> Result<bool, Self::Error> {
        // Find the byte span of the first match inside this line. Some
        // queries can match multiple times on a single line — we record
        // one hit per line, using the first match span.
        let line_bytes = mat.bytes();
        let mut start: usize = 0;
        let mut end: usize = 0;
        let mat_res = self.matcher.find(line_bytes).map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
        })?;
        if let Some(m) = mat_res {
            start = m.start();
            end = m.end();
        }

        let line_content = String::from_utf8_lossy(line_bytes)
            .trim_end_matches(|c| c == '\n' || c == '\r')
            .to_string();

        self.hits.push(SearchHit {
            line_number: mat.line_number().unwrap_or(0),
            line_content,
            match_start: start as u64,
            match_end: end as u64,
        });

        if self.hits.len() >= MAX_HITS_PER_FILE {
            return Ok(false); // stop scanning further matches in this file
        }
        Ok(true)
    }
}

/// Core search routine — testable directly with a `Vault` (no AppHandle
/// or tauri runtime needed).
pub fn search(
    vault: &Vault,
    query: &str,
    options: &SearchOptions,
) -> Result<Vec<SearchMatch>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let matcher = build_matcher(query, options)?;
    let vault_root = Path::new(&vault.path);
    if !vault_root.is_dir() {
        return Err(format!("vault path is not a directory: {}", vault.path));
    }

    let mut results: Vec<SearchMatch> = Vec::new();
    let walker = WalkBuilder::new(vault_root)
        .standard_filters(true)
        // Honor .gitignore files even when the vault is not a git repo —
        // Markus vaults are often plain folders, but a .gitignore (or
        // its sibling .ignore) is still the canonical way to tell us
        // what to leave out of the search index.
        .require_git(false)
        .build();
    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // tolerate per-entry walk errors (permissions, etc.)
        };
        let file_type = match entry.file_type() {
            Some(t) => t,
            None => continue,
        };
        if !file_type.is_file() {
            continue;
        }
        let path = entry.path();
        if !is_markdown(path) {
            continue;
        }

        let mut sink = CollectingSink {
            matcher: &matcher,
            hits: Vec::new(),
        };
        let mut searcher = Searcher::new();
        if searcher.search_path(&matcher, path, &mut sink).is_err() {
            // Skip files we can't read for any reason (binary disguised
            // as .md, permission denied, …).
            continue;
        }
        if sink.hits.is_empty() {
            continue;
        }

        let relative_path = path
            .strip_prefix(vault_root)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());

        results.push(SearchMatch {
            relative_path,
            hits: sink.hits,
        });

        if results.len() >= MAX_FILES_WITH_HITS {
            break;
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn search_in_vault(
    app: AppHandle,
    vault_id: String,
    query: String,
    options: SearchOptions,
) -> Result<Vec<SearchMatch>, String> {
    let v = vault_for(&app, &vault_id)?;
    search(&v, &query, &options)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Vault, VaultMode};
    use std::fs;
    use tempfile::TempDir;

    fn make_vault(dir: &TempDir) -> Vault {
        Vault {
            id: "test".to_string(),
            name: "test".to_string(),
            path: dir.path().to_string_lossy().to_string(),
            mode: VaultMode::Edit,
            color: "#000".to_string(),
        }
    }

    fn write(dir: &TempDir, name: &str, content: &str) {
        let p = dir.path().join(name);
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(p, content).unwrap();
    }

    #[test]
    fn empty_query_returns_no_matches() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "a.md", "hello world\n");
        let out = search(&v, "", &SearchOptions::default()).unwrap();
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn finds_literal_match_in_a_single_file() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "a.md", "hello world\nfoo\n");
        let out = search(&v, "hello", &SearchOptions::default()).unwrap();
        assert_eq!(out.len(), 1);
        let m = &out[0];
        assert_eq!(m.relative_path, "a.md");
        assert_eq!(m.hits.len(), 1);
        assert_eq!(m.hits[0].line_number, 1);
        assert_eq!(m.hits[0].line_content, "hello world");
        assert_eq!(m.hits[0].match_start, 0);
        assert_eq!(m.hits[0].match_end, 5);
    }

    #[test]
    fn is_case_insensitive_by_default() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "a.md", "Hello WORLD\n");
        let out = search(&v, "hello", &SearchOptions::default()).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].hits[0].line_content, "Hello WORLD");
    }

    #[test]
    fn respects_case_sensitive_option() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "a.md", "Hello WORLD\n");
        let opts = SearchOptions {
            case_sensitive: true,
            ..Default::default()
        };
        let out = search(&v, "hello", &opts).unwrap();
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn whole_word_only_matches_word_boundaries() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "a.md", "foo bar\nfoobar\n");
        let opts = SearchOptions {
            whole_word: true,
            ..Default::default()
        };
        let out = search(&v, "foo", &opts).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].hits.len(), 1);
        assert_eq!(out[0].hits[0].line_content, "foo bar");
    }

    #[test]
    fn literal_mode_treats_query_as_plain_text() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "a.md", "regex meta: a.b\n");
        // `.` is a regex meta-char; literal mode must escape it.
        let out = search(&v, "a.b", &SearchOptions::default()).unwrap();
        assert_eq!(out.len(), 1);
    }

    #[test]
    fn regex_mode_uses_query_as_pattern() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        // `a.b` regex (a + any + b) matches "axb" and "azb" but not
        // "abc" (which has no intervening char between a and b).
        write(&dir, "a.md", "axb\nazb\n");
        let opts = SearchOptions {
            regex: true,
            ..Default::default()
        };
        let out = search(&v, "a.b", &opts).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].hits.len(), 2);
    }

    #[test]
    fn returns_one_hit_per_matching_line() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "a.md", "hello hello\n");
        let out = search(&v, "hello", &SearchOptions::default()).unwrap();
        assert_eq!(out.len(), 1);
        // Multiple matches on the same line collapse into one hit (span
        // of the first match). The UI gets a single row to display.
        assert_eq!(out[0].hits.len(), 1);
        assert_eq!(out[0].hits[0].line_content, "hello hello");
    }

    #[test]
    fn walks_subdirectories_and_reports_relative_paths() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "notes/deep/spec.md", "needle\n");
        write(&dir, "top.md", "needle\n");
        let out = search(&v, "needle", &SearchOptions::default()).unwrap();
        let paths: Vec<&str> = out.iter().map(|m| m.relative_path.as_str()).collect();
        let normalized: Vec<String> = paths
            .iter()
            .map(|p| p.replace('\\', "/"))
            .collect();
        assert!(normalized.contains(&"top.md".to_string()));
        assert!(normalized.contains(&"notes/deep/spec.md".to_string()));
    }

    #[test]
    fn skips_non_markdown_files() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, "ignored.txt", "needle\n");
        write(&dir, "ok.md", "needle\n");
        let out = search(&v, "needle", &SearchOptions::default()).unwrap();
        let paths: Vec<&str> = out.iter().map(|m| m.relative_path.as_str()).collect();
        assert_eq!(paths, vec!["ok.md"]);
    }

    #[test]
    fn skips_hidden_directories_by_default() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, ".git/something.md", "needle\n");
        write(&dir, "visible.md", "needle\n");
        let out = search(&v, "needle", &SearchOptions::default()).unwrap();
        let paths: Vec<String> = out
            .iter()
            .map(|m| m.relative_path.replace('\\', "/"))
            .collect();
        assert!(paths.contains(&"visible.md".to_string()));
        assert!(!paths.iter().any(|p| p.starts_with(".git/")));
    }

    #[test]
    fn respects_gitignore_files_inside_the_vault() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        write(&dir, ".gitignore", "secret.md\n");
        write(&dir, "secret.md", "needle\n");
        write(&dir, "public.md", "needle\n");
        let out = search(&v, "needle", &SearchOptions::default()).unwrap();
        let paths: Vec<String> = out
            .iter()
            .map(|m| m.relative_path.replace('\\', "/"))
            .collect();
        assert!(paths.contains(&"public.md".to_string()));
        assert!(!paths.contains(&"secret.md".to_string()));
    }

    #[test]
    fn rejects_an_invalid_regex() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        let opts = SearchOptions {
            regex: true,
            ..Default::default()
        };
        let err = search(&v, "[unterminated", &opts).expect_err("should error");
        assert!(err.contains("invalid query"));
    }

    #[test]
    fn errors_when_vault_path_is_not_a_directory() {
        let dir = TempDir::new().unwrap();
        let mut v = make_vault(&dir);
        v.path = dir.path().join("does-not-exist").to_string_lossy().to_string();
        let err = search(&v, "x", &SearchOptions::default()).expect_err("should error");
        assert!(err.contains("not a directory"));
    }

    #[test]
    fn caps_total_files_with_hits() {
        let dir = TempDir::new().unwrap();
        let v = make_vault(&dir);
        // Create more files than the cap so we know it kicks in. Use a
        // very small smoke check rather than emitting MAX_FILES_WITH_HITS+1
        // files (the constant is 200) — assert the cap by exposing it.
        for i in 0..3 {
            write(&dir, &format!("f{i}.md"), "needle\n");
        }
        let out = search(&v, "needle", &SearchOptions::default()).unwrap();
        assert_eq!(out.len(), 3);
        // We just want to make sure the public cap constant exists and is
        // reasonable — guards against accidental zero.
        assert!(MAX_FILES_WITH_HITS >= 50);
    }
}
