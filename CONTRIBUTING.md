# Contributing

## Dev setup

```
npm install
npm run watch
```

Press F5 in VS Code to launch an Extension Development Host with the extension loaded.

## Before opening a PR

```
npm run check-types
npm run lint
npm run test:unit
npm run compile
```

All four must pass.

## Working on a new feature

This repo uses a small Claude Code agent team and a project skill to keep feature work consistent across sessions:

- `docs/ROADMAP.md` — phase checklist and acceptance criteria
- `docs/ARCHITECTURE.md` — locked technical design
- `.claude/agents/{manager,principal,tester}.md` — the roles used to plan, implement, and verify each phase
- `.claude/skills/build-feature/SKILL.md` — the end-to-end workflow tying the above together

If you're picking up the next roadmap phase (or proposing a new feature), start there rather than re-deriving the architecture from scratch.

## Branching

Branch from `main`, open a PR against `main`. Keep PRs scoped to one roadmap phase or one feature where possible.
