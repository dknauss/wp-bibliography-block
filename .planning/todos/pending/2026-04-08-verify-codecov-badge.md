---
created: 2026-04-08T00:00:00Z
title: Verify Codecov badge resolves after CI fix
area: ci
files:
  - /Users/danknauss/Developer/GitHub/wp-bibliography-block/.github/workflows/ci.yml
---

## Problem

The Codecov badge showed "unknown" because the CI workflow used `env.CODECOV_TOKEN` in
the `if:` condition, which is not available at step evaluation time. The condition was
fixed to use `secrets.CODECOV_TOKEN` and the redundant `env:` block was removed.

The fix was pushed as part of the 1.0.0 release. Badge status needs to be confirmed after
the next CI run on main.

## Acceptance targets

- Codecov badge in README resolves to a coverage percentage (not "unknown")
- No regression in coverage upload step in CI logs
