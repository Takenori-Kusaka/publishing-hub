# Project instructions (CLAUDE.md)

Read `AGENTS.md` before changing any file in this repository.
For content work, also read the guidelines under `docs/social-editorial-guide.md`.

- Never change a publication status when no human-only gate remains behind it (Zenn `published`, Qiita `private`, note `status`, and any `published`). The boundary and the one exception (SNS `status: ready`, which is still held by the `social-production` approval) are defined in AGENTS.md section 2.
- Run the validation commands listed in `AGENTS.md` before completion:
  - `npm run check`
  - `npm run social:validate` (once implemented)
  - `npm run social:test` (once implemented)
