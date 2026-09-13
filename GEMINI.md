@AGENTS.md
@docs/social-editorial-guide.md
@docs/ai-disclosure.md

# Gemini CLI Instructions (GEMINI.md)

You are operating in YOLO (autonomous) mode. Read and strictly adhere to all guidelines in `AGENTS.md` and `docs/social-editorial-guide.md`.

- **Strict Permission Bounds:** You may create SNS posts under `social/posts/` only with `status: draft`. You must never set status to `ready` or `published`.
- **Disclose AI Use:** Every manuscript you create or revise (Zenn, Qiita, note, SNS) must carry the AI-use notice at the top and the 「生成AIの利用について」 declaration as the last heading, exactly as specified in `docs/ai-disclosure.md`. Name only tools you can verify, and never claim a human check that has not happened. When you revise a manuscript, add yourself to its declaration (for example 「Gemini CLI（Google の gemini-3.7-flash）で本文を改訂しました」) in addition to the `Co-Authored-By: Gemini CLI` trailer; CI fails when a co-author in git is missing from the declaration.
- **Derivatives (Qiita / note / SNS):** Follow AGENTS.md section 2.3 step by step. Verify every factual sentence against the canonical article or the implementation, and delete any claim you cannot trace, even if it was already there before your edit. Copy code verbatim from the cited repository file, including end-of-line comments; put translations and explanations in the prose, and keep every `@gate` branch that precedes the lines you show. Never add a `Reviewed-by` trailer yourself; only a human reviewer may. Commit with LF line endings. Do not bring the canonical's statistics or history into a Qiita recipe or a note essay.
- **Do not dodge rules with paraphrase:** When a rule flags a sentence, rewrite it to what the canonical says or delete it. Synonyms, kanji numerals, euphemisms and adding an exception word are treated as the same violation. Fix the connective of the next sentence too.
- **Declare your own scope:** In the declaration, name each tool with the chapters and code you changed; do not copy the example sentence. Keep every model named in the Co-Authored-By trailers (for example Claude Opus 5).
- **Do not touch git configuration:** Never set user.name, user.email or core.autocrlf. If a commit fails, stop and report.
- **Warnings are failures for derivatives:** The qiita, note and variants stages run with `--strict`. Do not report remaining warnings as acceptable; fix them. If a verbatim code comment states an intent the canonical does not explain (for example bot-detection bypass), omit that line with `// ...` instead of keeping it.
- **Done means more than green:** `npm run check` with 0 errors and 0 warnings is required but not sufficient. Report which canonical section supports each changed claim.
- **Absolute Secrecy:** Never print, log, or commit secret tokens, API keys, or application passwords.
- **Validation Mandate:** Before completing any task, ensure that `npm run check` and all social checks are 100% green and free of errors.
