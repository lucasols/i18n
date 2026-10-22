# Stable translation ids

## Problem

The vite plugin assigns translation ids in the sorted order of the translation hashes (`TranslationRegistry.fromKeys` in `core/src/compiler.ts`). Adding or removing one string shifts the id of every string sorted after it, so the compiled `__t(N)` calls change in most app chunks.

## Impact

- The content hash of most app chunks changes on every deploy that touches a string, even when the components didn't change.
- Chunks importing those chunks change too, so returning users download most of the app again.
- Long-term caching of app chunks becomes ineffective for apps that ship string changes often.

## Proposed solution

An optional committed, append-only id manifest, e.g. `localesDir/.i18n-ids.json`:

- The plugin reads the manifest at startup and keeps the ids of the strings it lists.
- New strings found by the scan are appended with the next id.
- Removed strings are left as holes, compiled to `0` in the locale arrays, so the ids of the other strings never change.
- An optional `compact` flag (or CLI command) removes the holes and renumbers the ids, for an intentional one-time cache invalidation.
- The build writes the updated manifest back to disk. The dev server only appends in memory and writes on build, so editing code doesn't touch the file.
- The CLI `--fix` could also update the manifest, so it changes together with the locale files.

Possible format:

```json
{
  "version": 1,
  "ids": ["s:Direct Messages", "p:You have # unread messages", null]
}
```

The array index is the id, `null` marks a hole.

## Costs

- A new committed file and plugin option.
- Writing to disk during the build, which CI setups with read-only checkouts or cached builds need to handle (e.g. a `frozen` mode that fails when the manifest is outdated, like lockfiles).
- Merge conflicts when two branches append strings. Needs a merge rule: ids appended by both branches are reassigned in sorted order after the merge base entries, which only invalidates the chunks using the new strings.
- Holes in the locale arrays, a few bytes each until compacted.

## Alternatives considered

- **Ids from a stable hash of each string**: unchanged strings keep their ids without a manifest, but ids must be spread over a large range to avoid collisions, so the locale arrays become very sparse (or objects again), losing most of the size and lookup gains.
- **Document the trade-off only**: the current state. Simple, but keeps the cache invalidation on every string change.

## Test plan

- Adding a string keeps the ids of all existing strings and appends the new one.
- Removing a string leaves a hole compiled to `0`, the other ids are unchanged.
- `compact` removes holes and renumbers deterministically.
- Two builds with the same manifest and sources produce identical chunk hashes; adding a string only changes the chunks that use it and the locale chunks.
- `frozen` mode fails when the manifest is outdated.
- Merge of two manifests that appended different strings produces the documented ids.
