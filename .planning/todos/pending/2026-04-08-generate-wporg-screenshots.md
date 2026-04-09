---
created: 2026-04-08T00:00:00Z
title: Generate wp.org plugin-directory screenshots
area: marketing
files:
  - /Users/danknauss/Developer/GitHub/wp-bibliography-block/.wordpress-org/
---

## Problem

The wp.org plugin directory listing requires screenshots of the plugin in action.
The `.wordpress-org/` directory has banner and icon assets but no screenshots yet.
Screenshots must be PNG, named `screenshot-1.png`, `screenshot-2.png`, etc.

## Requires

A browser-capable Claude session:
`/Users/danknauss/bin/claude-playwright` or `/Users/danknauss/bin/claude-browser-handoff`

## Suggested shots

1. Block editor with a populated bibliography (shows paste input, citation list, style selector)
2. Published post frontend showing formatted bibliography with JSON-LD/COinS output visible in source
3. (Optional) Manual entry form open with fields populated

## Acceptance targets

- At least 2 screenshots in `.wordpress-org/` named `screenshot-1.png`, `screenshot-2.png`
- Each is 1200×900 px or close to it (wp.org preferred dimensions)
- Screenshots committed and included in the release zip path
