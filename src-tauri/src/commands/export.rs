//! Markdown export pipeline.
//!
//! `normalize_markdown_export` : normalisation pure (pas d'I/O).
//! Stratégie "Minimal" :
//!   - Frontmatter YAML (bloc `---\n…\n---\n` en tête) → passthrough verbatim.
//!   - Body : CRLF → LF, trim trailing whitespace par ligne,
//!     collapse 3+ newlines consécutifs → 2, exactement un final `\n`.
//!
//! `export_to_path` : applique la normalisation et écrit sur disque à un
//! path absolu choisi par le file picker. Overwrite OK (confiance dialog).
//!
//! Aucune transformation du contenu sémantique (listes, emphases, headings,
//! liens, blocs, etc.) — on touche au whitespace, pas aux tokens markdown.

use std::fs;
use std::path::Path;

/// Sépare `raw` en `(frontmatter, body)`. Le frontmatter inclut son `\n`
/// final s'il existait dans la source — on le passe-through verbatim.
/// Si pas de frontmatter détecté, `frontmatter` est `""` et `body` est `raw`.
fn split_frontmatter(raw: &str) -> (&str, &str) {
    // Le frontmatter commence forcément par "---" suivi d'un saut de ligne.
    // Tolère "---\n" et "---\r\n".
    let after_open = if let Some(rest) = raw.strip_prefix("---\n") {
        rest
    } else if let Some(rest) = raw.strip_prefix("---\r\n") {
        rest
    } else {
        return ("", raw);
    };

    // Cherche un délimiteur fermant "---" en début de ligne, suivi d'un saut
    // de ligne ou de la fin de fichier. On itère ligne par ligne pour ne pas
    // matcher un "---" qui serait au milieu d'une ligne.
    let mut cursor = 0usize;
    let bytes = after_open.as_bytes();
    while cursor < bytes.len() {
        // Trouve la fin de la ligne courante.
        let line_end = after_open[cursor..]
            .find('\n')
            .map(|i| cursor + i)
            .unwrap_or(bytes.len());
        let line = &after_open[cursor..line_end];
        // Tolère un "---\r" (CRLF) en stripant le CR.
        let line_trimmed = line.strip_suffix('\r').unwrap_or(line);
        if line_trimmed == "---" {
            // Frontmatter délimité : de raw[0] jusqu'à la fin de cette ligne
            // (+ son \n s'il existe).
            let end = if line_end < bytes.len() {
                // inclut le '\n'
                let abs = "---\n".len() + line_end + 1;
                abs
            } else {
                "---\n".len() + line_end
            };
            return (&raw[..end], &raw[end..]);
        }
        if line_end == bytes.len() {
            break;
        }
        cursor = line_end + 1;
    }
    // Pas de fermeture trouvée — on traite tout comme body.
    ("", raw)
}

/// Normalise le body markdown :
///   1. CRLF / CR isolés → LF
///   2. trim trailing whitespace (espaces + tabs) en fin de ligne
///   3. collapse 3+ `\n` consécutifs → 2 `\n`
///   4. exactement un `\n` final (ni zéro ni plus), ou "" si l'input est vide
fn normalize_body(body: &str) -> String {
    if body.is_empty() {
        return String::new();
    }

    // (1) Normalise les line endings : CRLF → LF, CR isolé → LF.
    let lf_only: String = {
        let mut out = String::with_capacity(body.len());
        let mut chars = body.chars().peekable();
        while let Some(c) = chars.next() {
            if c == '\r' {
                // CR ou CRLF → LF (on consomme le \n suivant s'il existe).
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                out.push('\n');
            } else {
                out.push(c);
            }
        }
        out
    };

    // (2) Trim trailing whitespace par ligne.
    let mut trimmed = String::with_capacity(lf_only.len());
    for (i, line) in lf_only.split('\n').enumerate() {
        if i > 0 {
            trimmed.push('\n');
        }
        let cleaned = line.trim_end_matches(|c: char| c == ' ' || c == '\t');
        trimmed.push_str(cleaned);
    }

    // (3) Collapse 3+ newlines → 2.
    let mut collapsed = String::with_capacity(trimmed.len());
    let mut newline_run = 0usize;
    for c in trimmed.chars() {
        if c == '\n' {
            newline_run += 1;
            if newline_run <= 2 {
                collapsed.push('\n');
            }
        } else {
            newline_run = 0;
            collapsed.push(c);
        }
    }

    // (4) Exactement un `\n` final.
    let stripped = collapsed.trim_end_matches('\n');
    if stripped.is_empty() {
        // body était que du whitespace / newlines → vide.
        return String::new();
    }
    let mut out = String::with_capacity(stripped.len() + 1);
    out.push_str(stripped);
    out.push('\n');
    out
}

/// Garde-fous sur le target path avant écriture :
///   - doit être absolu (le dialog système retourne toujours un absolu ;
///     un relatif signifie un appel malformé ou une tentative malveillante)
///   - pas de caractères de contrôle (NUL, etc.) dans la string
///   - le dossier parent doit exister (le dialog garantit ça en pratique ;
///     on échoue franchement plutôt que de créer des dossiers à l'aveugle)
fn validate_target_path(target_path: &str) -> Result<&Path, String> {
    if target_path.chars().any(|c| c.is_control()) {
        return Err("Target path contains control characters".to_string());
    }
    let path = Path::new(target_path);
    if !path.is_absolute() {
        return Err("Target path must be absolute".to_string());
    }
    match path.parent() {
        Some(parent) if parent.exists() && parent.is_dir() => Ok(path),
        Some(_) => Err(format!(
            "Target parent directory does not exist: {target_path}"
        )),
        None => Err("Target path has no parent directory".to_string()),
    }
}

/// Normalise `content` via `normalize_markdown_export` et l'écrit à
/// `target_path` (absolu). Overwrite sans question — le file picker système
/// a déjà confirmé avec l'utilisateur en amont.
pub fn export_to_path(content: &str, target_path: &str) -> Result<(), String> {
    let path = validate_target_path(target_path)?;
    let normalized = normalize_markdown_export(content);
    fs::write(path, normalized)
        .map_err(|e| format!("Failed to write export to {target_path}: {e}"))
}

/// Commande Tauri : `content` est le markdown à exporter (buffer courant de
/// l'éditeur OU contenu lu depuis le vault — le front décide), `target_path`
/// est le chemin absolu choisi par le dialog système.
#[tauri::command]
pub fn file_export(content: String, target_path: String) -> Result<(), String> {
    export_to_path(&content, &target_path)
}

/// Entrée publique du pipeline. Idempotente.
pub fn normalize_markdown_export(raw: &str) -> String {
    let (frontmatter, body) = split_frontmatter(raw);
    let normalized_body = normalize_body(body);
    if frontmatter.is_empty() {
        return normalized_body;
    }
    // Frontmatter verbatim (inclut son `\n` final). Le body normalisé
    // commencerait par `\n\n…` si l'input avait des lignes vides — au lieu
    // de garder ces newlines en doublon avec le `\n` du frontmatter, on
    // strip les LF de tête et on insère exactement une blank line entre
    // les deux blocs (séparation standard YAML / markdown).
    let body_trimmed = normalized_body.trim_start_matches('\n');
    let mut out = String::with_capacity(frontmatter.len() + body_trimmed.len() + 1);
    out.push_str(frontmatter);
    if !body_trimmed.is_empty() {
        out.push('\n');
        out.push_str(body_trimmed);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // ============================================================
    // E1 — Cas vides / edge cases
    // ============================================================

    #[test]
    fn empty_input_returns_empty() {
        assert_eq!(normalize_markdown_export(""), "");
    }

    #[test]
    fn only_whitespace_collapses_to_empty() {
        assert_eq!(normalize_markdown_export("   \n\n\t  \n"), "");
    }

    // ============================================================
    // E2 — Final newline
    // ============================================================

    #[test]
    fn single_line_gets_final_newline() {
        assert_eq!(normalize_markdown_export("hello"), "hello\n");
    }

    #[test]
    fn multiple_trailing_newlines_collapse_to_one() {
        assert_eq!(normalize_markdown_export("hello\n\n\n"), "hello\n");
    }

    #[test]
    fn existing_single_final_newline_is_preserved() {
        assert_eq!(normalize_markdown_export("hello\n"), "hello\n");
    }

    // ============================================================
    // E3 — Trim trailing whitespace par ligne
    // ============================================================

    #[test]
    fn trims_trailing_spaces() {
        assert_eq!(
            normalize_markdown_export("hello   \nworld   "),
            "hello\nworld\n"
        );
    }

    #[test]
    fn trims_trailing_tabs_and_mixed_whitespace() {
        assert_eq!(
            normalize_markdown_export("foo\t \t\nbar \t"),
            "foo\nbar\n"
        );
    }

    #[test]
    fn preserves_leading_whitespace() {
        // L'indentation des listes / code n'est PAS du trailing whitespace.
        assert_eq!(
            normalize_markdown_export("  - item one\n  - item two"),
            "  - item one\n  - item two\n"
        );
    }

    // ============================================================
    // E4 — Collapse 3+ newlines → 2
    // ============================================================

    #[test]
    fn collapses_four_newlines_to_two() {
        assert_eq!(
            normalize_markdown_export("a\n\n\n\nb"),
            "a\n\nb\n"
        );
    }

    #[test]
    fn preserves_double_newline() {
        assert_eq!(normalize_markdown_export("a\n\nb"), "a\n\nb\n");
    }

    #[test]
    fn preserves_single_newline_between_lines() {
        assert_eq!(normalize_markdown_export("a\nb"), "a\nb\n");
    }

    // ============================================================
    // E5 — Line endings : CRLF / CR → LF
    // ============================================================

    #[test]
    fn crlf_is_normalized_to_lf() {
        assert_eq!(
            normalize_markdown_export("hello\r\nworld\r\n"),
            "hello\nworld\n"
        );
    }

    #[test]
    fn lone_cr_is_normalized_to_lf() {
        assert_eq!(normalize_markdown_export("hello\rworld"), "hello\nworld\n");
    }

    // ============================================================
    // E6 — Idempotence
    // ============================================================

    #[test]
    fn idempotent_on_messy_input() {
        let raw = "  - item   \n\n\n\n  - other \t\n\n\n";
        let once = normalize_markdown_export(raw);
        let twice = normalize_markdown_export(&once);
        assert_eq!(once, twice);
    }

    #[test]
    fn idempotent_on_frontmatter_input() {
        let raw = "---\ntitle: Hello\ntags: [a, b]\n---\n\n\nBody  \n\n\n";
        let once = normalize_markdown_export(raw);
        let twice = normalize_markdown_export(&once);
        assert_eq!(once, twice);
    }

    // ============================================================
    // E7 — Frontmatter passthrough verbatim
    // ============================================================

    #[test]
    fn frontmatter_inner_whitespace_is_passed_through_verbatim() {
        // Le YAML d'origine a un trailing space sur la ligne `title:` —
        // on NE le touche PAS (passthrough verbatim à l'intérieur du bloc).
        let raw = "---\ntitle: Hello \ntags:\n  - a\n  - b\n---\n\nBody";
        let expected = "---\ntitle: Hello \ntags:\n  - a\n  - b\n---\n\nBody\n";
        assert_eq!(normalize_markdown_export(raw), expected);
    }

    #[test]
    fn blank_line_is_inserted_between_frontmatter_and_body() {
        // Convention standard markdown : exactement une ligne vide entre
        // le `---` fermant et le premier paragraphe du body.
        let raw = "---\ntitle: Hi\n---\nBody";
        let expected = "---\ntitle: Hi\n---\n\nBody\n";
        assert_eq!(normalize_markdown_export(raw), expected);
    }

    #[test]
    fn frontmatter_only_input_is_preserved() {
        let raw = "---\ntitle: Hello\n---\n";
        assert_eq!(normalize_markdown_export(raw), "---\ntitle: Hello\n---\n");
    }

    #[test]
    fn body_after_frontmatter_is_normalized() {
        let raw = "---\ntitle: Hi\n---\n\n\n\nHello world   \n\n\n";
        let expected = "---\ntitle: Hi\n---\n\nHello world\n";
        assert_eq!(normalize_markdown_export(raw), expected);
    }

    // ============================================================
    // E8 — Frontmatter mal formé / absent
    // ============================================================

    #[test]
    fn no_frontmatter_treats_whole_input_as_body() {
        let raw = "# Hello\n\nWorld";
        assert_eq!(normalize_markdown_export(raw), "# Hello\n\nWorld\n");
    }

    #[test]
    fn unclosed_frontmatter_is_treated_as_body() {
        // Pas de fermeture `---` → tout est body. On normalise normalement.
        let raw = "---\ntitle: Hello\nno closing dashes";
        let expected = "---\ntitle: Hello\nno closing dashes\n";
        assert_eq!(normalize_markdown_export(raw), expected);
    }

    #[test]
    fn three_dashes_not_at_start_are_not_frontmatter() {
        // Une thematic break `---` au milieu du doc n'est pas un frontmatter.
        let raw = "Body\n\n---\n\nMore body";
        assert_eq!(
            normalize_markdown_export(raw),
            "Body\n\n---\n\nMore body\n"
        );
    }

    // ============================================================
    // E9 — Combinaison réaliste
    // ============================================================

    #[test]
    fn realistic_messy_export_is_clean() {
        let raw = concat!(
            "---\n",
            "title: My Note\n",
            "tags:\n",
            "  - draft\n",
            "---\n",
            "\n",
            "# Heading   \n",
            "\n",
            "\n",
            "Paragraph with trailing space   \n",
            "\n",
            "\n",
            "\n",
            "- item one  \n",
            "- item two\t\n",
            "\n",
        );
        let expected = concat!(
            "---\n",
            "title: My Note\n",
            "tags:\n",
            "  - draft\n",
            "---\n",
            "\n",
            "# Heading\n",
            "\n",
            "Paragraph with trailing space\n",
            "\n",
            "- item one\n",
            "- item two\n",
        );
        assert_eq!(normalize_markdown_export(raw), expected);
    }

    // ============================================================
    // X1 — export_to_path : happy path
    // ============================================================

    #[test]
    fn export_writes_normalized_content_to_target() {
        let dir = TempDir::new().unwrap();
        let target = dir.path().join("out.md");
        let target_str = target.to_string_lossy().to_string();

        // Content "messy" → on doit retrouver du normalisé sur disque.
        let messy = "# Title   \n\n\n\nBody  \n\n\n";
        export_to_path(messy, &target_str).expect("export succeeds");

        let on_disk = fs::read_to_string(&target).unwrap();
        assert_eq!(on_disk, "# Title\n\nBody\n");
    }

    #[test]
    fn export_writes_frontmatter_preserved_body_normalized() {
        let dir = TempDir::new().unwrap();
        let target = dir.path().join("note.md");
        let target_str = target.to_string_lossy().to_string();

        let raw = "---\ntitle: Hi\n---\nBody   \n\n\n";
        export_to_path(raw, &target_str).expect("export succeeds");

        let on_disk = fs::read_to_string(&target).unwrap();
        assert_eq!(on_disk, "---\ntitle: Hi\n---\n\nBody\n");
    }

    // ============================================================
    // X2 — Overwrite (confiance file picker)
    // ============================================================

    #[test]
    fn export_overwrites_existing_target_file() {
        let dir = TempDir::new().unwrap();
        let target = dir.path().join("existing.md");
        fs::write(&target, "OLD CONTENT").unwrap();

        let target_str = target.to_string_lossy().to_string();
        export_to_path("new", &target_str).expect("overwrite succeeds");

        let on_disk = fs::read_to_string(&target).unwrap();
        assert_eq!(on_disk, "new\n");
    }

    // ============================================================
    // X3 — Validation du target_path
    // ============================================================

    #[test]
    fn export_rejects_relative_target_path() {
        let err = export_to_path("hi", "relative/path.md").expect_err("relative must reject");
        assert!(
            err.contains("absolute"),
            "error must mention 'absolute' (got: {err})"
        );
    }

    #[test]
    fn export_rejects_target_path_with_control_chars() {
        let dir = TempDir::new().unwrap();
        let bad = format!("{}/with\0nul.md", dir.path().to_string_lossy());
        let err = export_to_path("hi", &bad).expect_err("control chars must reject");
        assert!(
            err.contains("control"),
            "error must mention 'control' (got: {err})"
        );
    }

    #[test]
    fn export_rejects_target_in_nonexistent_parent_dir() {
        let dir = TempDir::new().unwrap();
        let bad = dir
            .path()
            .join("does-not-exist")
            .join("out.md")
            .to_string_lossy()
            .to_string();
        let err = export_to_path("hi", &bad).expect_err("missing parent must reject");
        assert!(
            err.contains("parent"),
            "error must mention 'parent' (got: {err})"
        );
    }

    // ============================================================
    // X4 — Idempotence sur disque
    // ============================================================

    #[test]
    fn export_is_idempotent_when_re_exporting_what_we_wrote() {
        let dir = TempDir::new().unwrap();
        let target = dir.path().join("out.md");
        let target_str = target.to_string_lossy().to_string();

        let raw = "  - one  \n\n\n  - two\t\n";
        export_to_path(raw, &target_str).unwrap();
        let first = fs::read_to_string(&target).unwrap();

        export_to_path(&first, &target_str).unwrap();
        let second = fs::read_to_string(&target).unwrap();

        assert_eq!(first, second, "re-exporting normalized content is a no-op");
    }
}
