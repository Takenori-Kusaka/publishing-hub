@AGENTS.md
@docs/social-editorial-guide.md
@docs/ai-disclosure.md

# Gemini CLI Instructions (GEMINI.md)

You are operating in YOLO (autonomous) mode. Read and strictly adhere to all guidelines in `AGENTS.md` and `docs/social-editorial-guide.md`.

- **Strict Permission Bounds:** You may create SNS posts under `social/posts/` only with `status: draft`. You must never set status to `ready` or `published`.
- **Edit only what the task names:** Change only the manuscripts the task lists. Do not touch other manuscripts, including SNS posts in `status: ready` or later, even to fix a claim; report such problems instead.
- **Disclose AI Use:** Every manuscript you create or revise (Zenn, Qiita, note, SNS) must carry the AI-use notice at the top and the 「生成AIの利用について」 declaration as the last heading, exactly as specified in `docs/ai-disclosure.md`. Name only tools you can verify, and never claim a human check that has not happened.
- **Record yourself in git and in the declaration:** Commit with the trailer `Co-Authored-By: Gemini CLI (gemini-3.7-flash) <noreply@google.com>` (tool name plus the model in parentheses). Add your own sentence to the declaration that names the tool, the model and the exact scope, for example 「Gemini CLI（Google の gemini-3.7-flash）で、2 章「技術選定理由」と 3.1 節のコードの抜粋を改訂しました。」 CI checks the trailers against the declaration in both directions.
- **Do not rewrite other tools' sentences:** Keep the existing sentences about Claude and other tools as they are. Never widen their purpose (for example from 改稿 to 作成) to satisfy a check; a model whose commits only added the disclosure frame must not be credited with drafting. Write your own involvement in a separate sentence.
- **Declare your own scope concretely:** Name the chapters or section headings and the code paths you changed. Generic scopes such as 「全体の改訂」「検証の修正」 fail the check.
- **Derivatives (Qiita / note / SNS):** Follow AGENTS.md section 2.3 step by step. Verify every factual sentence against the canonical article or the implementation, and delete any claim you cannot trace, even if it was already there before your edit. Copy code verbatim from the cited repository file, including end-of-line comments; put translations and explanations in the prose, keep every `@gate` branch that precedes the lines you show, and put `// ...` wherever you skip source lines. Never add a `Reviewed-by` trailer yourself; only a human reviewer may. Do not bring the canonical's statistics or history into a Qiita recipe or a note essay.
- **Do not dodge rules with paraphrase:** When a rule flags a sentence, rewrite it to what the canonical says or delete it. Synonyms (安全な基盤 → 安全な環境), kanji numerals, euphemisms (工数が増えた → 作業の重さを実感) and adding an exception word are treated as the same violation. When you delete or rewrite a sentence, fix the connective of the next sentence too (同じ理由で, しかし); V13 compares with the previous version and fails on a stale connective.
- **Do not touch git configuration:** Never set user.name, user.email or core.autocrlf. If a commit fails, stop and report.
- **Warnings are failures for derivatives:** The qiita, note and variants stages run with `--strict`. Do not report remaining warnings as acceptable; fix them. If a verbatim code comment states an intent the canonical does not explain (for example bot-detection bypass), omit that line with `// ...` instead of keeping it.
- **Done means more than green:** Run `npm run check` again after `git commit`, and paste its 「検査した状態」 line (HEAD, index tree, uncommitted changes) into your final report. A result from before the commit does not prove the committed state. 0 errors and 0 warnings is required but not sufficient: report which canonical section supports each changed claim.
- **Absolute Secrecy:** Never print, log, or commit secret tokens, API keys, or application passwords.
- **Validation Mandate:** Before completing any task, ensure that `npm run check` and all social checks are 100% green and free of errors.
