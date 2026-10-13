# anti-slop provenance

- Installed: 2026-10-13, via `install-anti-slop` skill `scripts/install.mjs`
- Destination: `tools/oxlint/anti-slop/` (index at `tools/oxlint/anti-slop/index.ts`)
- Source repository: bundled with the `install-anti-slop` skill in this workspace
  (`.claude/skills/install-anti-slop/assets/anti-slop/`); no upstream git metadata
  available here, so the exact source commit is unknown.
- Deviations from upstream: none — files copied as-is, including
  `vendor/eslint-stylistic/LICENSE`.
- Dependencies: `oxlint@1.88.0`, `@oxlint/plugins@1.88.0` (pinned, devDependencies).
- Config: `oxlint.config.ts` registers the generic plugin; 17 generic rules (require-safety-comment-for-type-assertion disabled by user choice: zero comments in codebase) plus
  `oxc/no-accumulating-spread` enabled at `"error"`. Effect plugin not installed
  (no `effect` dependency in package.json).
