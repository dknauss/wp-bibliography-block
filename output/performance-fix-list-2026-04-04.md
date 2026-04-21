# Bibliography Builder performance fix list

Date: 2026-04-04
Repo: `/Users/danknauss/Developer/GitHub/wp-bibliography-block`

## Ranked by likely impact

### 1. Batch or memoize editor-side CSL formatting
**Impact:** High  
**Effort:** Medium

Primary target:
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/src/lib/formatting/csl.js`

Why:
- profiling indicates PHP is not the bottleneck
- the expensive work is mostly in editor-side citation formatting
- `new Cite(csl)` plus bibliography formatting is still on hot paths for import, edit, and style switching

Recommended actions:
- keep the current cache, but expand it to cover more call sites consistently
- add a batch formatting path for style changes instead of formatting every entry independently
- verify cache hit rate during large imports and style switches

### 2. Stop eagerly formatting every parsed item during import
**Impact:** High  
**Effort:** Medium

Primary target:
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/src/lib/parser.js`

Why:
- import currently pays parse + sanitize + format in one critical path
- this makes large paste operations feel slower than necessary

Recommended actions:
- parse all items first
- defer `formattedText` generation until after parse completion
- or lazily format only when an entry is first rendered/needed

### 3. Reduce plugin PHP registration overhead from `build/index.asset.php`
**Impact:** Medium  
**Effort:** Low

Primary targets:
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/bibliography-builder.php`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/build/index.asset.php`

Why:
- Xdebug profiles show the only repeatable plugin-specific PHP cost is asset metadata loading during block registration

Recommended actions:
- keep build dependencies lean so `build/index.asset.php` stays small
- avoid adding more package dependencies casually
- consider reviewing whether all current script dependencies are required at registration time

### 4. Shrink deferred citation chunks
**Impact:** Medium  
**Effort:** Medium/High

Primary targets:
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/build/55.js`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/build/592.js`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/build/citation-citeproc.js`

Why:
- these chunks are still the largest shipped assets
- editor responsiveness after first load/style switch may still suffer

Recommended actions:
- audit citation-js / citeproc imports for dead weight
- ensure styles are loaded lazily only when needed
- avoid bundling extra style/template logic into the main editor path

### 5. Add a real performance benchmark harness
**Impact:** Medium  
**Effort:** Medium

Primary targets:
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/`
- optional CI/docs additions

Why:
- Studio profiling now works, but it is not stable enough for routine measurement
- the project needs repeatable before/after numbers for import and style-switch performance

Recommended actions:
- add a fixed large bibliography fixture
- measure:
  - import of 10, 25, 50 items
  - style switch across large lists
  - manual entry add/edit latency
- store results in a simple markdown or JSON benchmark artifact

### 6. Re-check whether JSON-LD generation should stay default-on for large bibliographies
**Impact:** Low/Medium  
**Effort:** Low

Primary target:
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/src/save-markup.js`

Why:
- not a runtime bottleneck in PHP profiling, but it increases final saved HTML weight
- this matters more as bibliography size grows

Recommended actions:
- keep JSON-LD default-on for now
- document expected tradeoff
- consider a future threshold or warning for very large bibliographies

## Recommended implementation order
1. Batch/memoize CSL formatting more aggressively
2. Defer eager formatting during import
3. Keep `build/index.asset.php` lean
4. Reduce deferred citation chunk size
5. Add repeatable benchmark harness
6. Revisit metadata output weight only if large-bibliography payload becomes a problem

## Bottom line
Based on actual Xdebug profiling, the plugin's next performance wins are **not** in PHP business logic. The best returns will come from:
- editor-side formatting optimization
- import-path deferral
- JS bundle reduction
