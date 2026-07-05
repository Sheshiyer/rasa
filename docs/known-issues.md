# Known Issues

## Spurious esbuild tsconfig warning on `pnpm test`

Running `pnpm test` prints one warning at startup:

```
▲ [WARNING] Cannot find base config file "astro/tsconfigs/strict" [tsconfig.json]
    ../../../tsconfig.json:2:13
```

**Cause:** external, not a Rasa defect. This repo lives inside a larger vault
(`/Volumes/madara/2026/twc-vault/`). A `tsconfig.json` three levels up (the vault
root) does `"extends": "astro/tsconfigs/strict"`, but `astro` is not installed at
that level. Vite/esbuild's tsconfig discovery walks up the filesystem at startup and
hits that broken file.

**Impact:** none. All tests pass and `pnpm typecheck` is clean (typecheck uses each
package's explicit `tsconfig.json` and never touches the vault file).

**Why not fixed here:** the offending file is outside this repo (it belongs to the
vault) and modifying it is out of scope. Attempts to suppress it from inside the repo
(`esbuild.tsconfigRaw`, `logOverride`, a self-contained root `tsconfig.json`, a `.js`
Vitest config) do not stop the vault-level walk because it happens during Vite's
startup scan. If this repo is ever cloned out of the vault, the warning disappears.
