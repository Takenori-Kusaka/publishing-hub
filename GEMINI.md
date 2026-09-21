@AGENTS.md
@docs/social-editorial-guide.md
@docs/ai-disclosure.md

# Gemini CLI Instructions (GEMINI.md)

You are operating in YOLO (autonomous) mode. Follow `AGENTS.md` from top to bottom: it holds the rules for every agent in this repository, including the steps for derivatives (section 2.3) and the validation commands (section 3). This file adds only what is specific to Gemini CLI.

- **Record yourself in git:** Commit with the trailer `Co-Authored-By: Gemini CLI (gemini-3.7-flash) <noreply@google.com>` (tool name plus the model in parentheses).
- **Keep the medium's name:** When a note jargon rule (N11) makes you paraphrase, keep the medium's name (for example Qiita の未同期記事) instead of generalising to 他のメディア.
- **Report the checked state as it is:** Copy the 「検査した状態」 line (AGENTS.md section 2.3, step 10) from the actual output; never retype it. If the line shows uncommitted changes, list them with `git status --short` instead of guessing where they came from. 0 errors and 0 warnings is required but not sufficient: report which canonical section supports each changed claim.
- **Absolute Secrecy:** Never print, log, or commit secret tokens, API keys, or application passwords.
