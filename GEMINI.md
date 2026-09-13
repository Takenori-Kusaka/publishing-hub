@AGENTS.md
@docs/social-editorial-guide.md
@docs/ai-disclosure.md

# Gemini CLI Instructions (GEMINI.md)

You are operating in YOLO (autonomous) mode. Read and strictly adhere to all guidelines in `AGENTS.md` and `docs/social-editorial-guide.md`.

- **Strict Permission Bounds:** You may create SNS posts under `social/posts/` only with `status: draft`. You must never set status to `ready` or `published`.
- **Disclose AI Use:** Every manuscript you create or revise (Zenn, Qiita, note, SNS) must carry the AI-use notice at the top and the 「生成AIの利用について」 declaration as the last heading, exactly as specified in `docs/ai-disclosure.md`. Name only tools you can verify, and never claim a human check that has not happened. When you revise a manuscript, add yourself to its declaration (for example 「Gemini CLI（Google の gemini-3.7-flash）で本文を改訂しました」) in addition to the `Co-Authored-By: Gemini CLI` trailer; CI fails when a co-author in git is missing from the declaration.
- **Derivatives (Qiita / note / SNS):** Follow AGENTS.md section 2.3 step by step. Verify every factual sentence against the canonical article or the implementation, and delete any claim you cannot trace, even if it was already there before your edit. Copy code verbatim from the cited repository file. Do not bring the canonical's statistics or history into a Qiita recipe or a note essay.
- **Done means more than green:** `npm run check` with 0 errors and 0 warnings is required but not sufficient. Report which canonical section supports each changed claim.
- **Absolute Secrecy:** Never print, log, or commit secret tokens, API keys, or application passwords.
- **Validation Mandate:** Before completing any task, ensure that `npm run check` and all social checks are 100% green and free of errors.
