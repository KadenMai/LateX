---
name: build-feature
description: Use when picking up the next LaTeX View roadmap phase or implementing a new feature request for the LaTeX View VS Code extension. Encodes the manager -> principal -> tester workflow so feature work stays consistent across sessions without re-deriving the architecture.
---

# Building a LaTeX View feature

This skill is the repeatable workflow for advancing the LaTeX View VS Code extension (view/edit `.tex`, HTML preview, PDF export, margin editing). Use it instead of re-deriving the architecture from scratch each session.

## Steps

1. Read `docs/ROADMAP.md` to find the next unchecked phase, or map the user's requested feature onto an existing phase (add a new checklist item if it doesn't fit one).
2. Read `docs/ARCHITECTURE.md` and `CLAUDE.md` for the locked architecture decisions and conventions — do not relitigate the dual PDF-engine or LaTeX.js+KaTeX preview decisions.
3. Delegate breakdown to the **manager** agent (`.claude/agents/manager.md`): it turns the phase/feature into a concrete task list and records it in `docs/ROADMAP.md`.
4. Delegate implementation to the **principal** agent (`.claude/agents/principal.md`) for each task.
5. Delegate verification to the **tester** agent (`.claude/agents/tester.md`): unit tests, integration smoke tests, and acceptance-criteria checking against `docs/ROADMAP.md`.
6. Once tester confirms the acceptance criteria are met, update `CHANGELOG.md` under `[Unreleased]` and check off the phase/tasks in `docs/ROADMAP.md`.
7. Confirm before finishing: `npm run check-types && npm run lint && npm run test:unit && npm run compile` all pass.

## When to stop and ask the user

- If a task seems to require changing a locked architecture decision (PDF engine strategy, HTML preview approach).
- If a roadmap phase's scope is ambiguous relative to what the user actually asked for.
- Before any `vsce publish` (Phase 5) — publishing is irreversible-ish and user-facing; always confirm first.
