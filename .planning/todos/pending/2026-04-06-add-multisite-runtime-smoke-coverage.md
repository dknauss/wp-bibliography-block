---
created: 2026-04-06T17:15:00Z
title: Add multisite runtime smoke coverage
area: testing
files:
  - /Users/danknauss/Developer/GitHub/wp-bibliography-block/.github/workflows/runtime-matrix.yml
  - /Users/danknauss/Developer/GitHub/wp-bibliography-block/scripts/runtime-matrix/smoke.sh
  - /Users/danknauss/Developer/GitHub/wp-bibliography-block/README.md
---

## Problem

The runtime matrix now covers a wider PHP, WordPress, Apache, Nginx, and SQLite range for single-site installs, but it still does not exercise plugin behavior on WordPress multisite.

## Solution

Add at least one multisite smoke lane to the runtime matrix, verify plugin activation and bibliography REST/frontend behavior on a subdirectory multisite network, and capture the same runtime artifacts as the current single-site lanes.

## Acceptance targets

- at least one Apache-based multisite runtime smoke lane exists
- plugin activation and a basic bibliography post smoke test pass on multisite
- runtime artifacts include enough detail to diagnose multisite bootstrap failures
- README runtime-matrix notes mention multisite coverage once shipped
