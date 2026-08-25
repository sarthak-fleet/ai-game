---
title: Working on docs
description: How the docs tree is organized and validated.
sidebar:
  order: 4
---

# Working on docs

The committed Markdown under `docs/` is the **source of truth**. Code and executable configuration remain
authoritative for implementation details and schedules.

## Tree

```
docs/
  index.md                      navigation hub (this site's home)
  product/                      what the product is and which surfaces exist
  architecture/                 how it's built
    decisions/                  pinned technical decisions (ADRs)
  development/                  how to build, test, perf, and work on docs
  operations/                   CI, deploy, runbooks
    runbooks/                   step-by-step operational runbooks
  knowledge/                    durable learnings + failed approaches
    learnings/                  concept bridges to external sources
    experiments/                focused spikes with explicit verdicts
    research/                   broader research passes
    retros/                     retrospectives
  current/                      short-lived current state (milestone plans, roadmap snapshots)
  archive/                      superseded docs (kept for git history)
```

## Rules

1. **One canonical home per fact.** Don't re-explain something that already
   has a doc — link to it.
2. **Markdown is the source of truth.** Generated presentation artifacts are
   not part of this repository's documentation contract.
3. **Don't duplicate code-discoverable facts.** Link to the file or command
   instead.
4. **Mark unresolved questions explicitly** — do not invent information.
5. **Prefer `docs/archive/<name>.md` over deletion** so git rename history
   survives.
6. **Keep pages 150–300 lines.** Split catch-all pages into focused topics.
7. **Learning docs lean on external sources.** For concepts with
   authoritative sources, reduce each entry to: one-sentence "what",
   one-sentence "why it matters here", link to the source, optional "where
   in this codebase".

## Frontmatter

Every `docs/**/*.md` (except `archive/`) must have a `title` in frontmatter.
Optional fields: `description`,
`sidebar.order`.

## Validate

```bash
pnpm check:docs        # link + structure + frontmatter checks
# or: node scripts/check-docs.mjs
```

CI runs this on every push/PR via `.github/workflows/docs.yml`. The checker
verifies:

- `docs/index.md` exists.
- Every `docs/**/*.md` (except `archive/`) has a `title` in frontmatter.
- Every relative Markdown link resolves to a file that exists.
- No empty `docs/` subdirectories.

Archived docs are preserved for git history. The checker skips frontmatter and
link checks for `docs/archive/**` because historical links may reflect their
original locations.
