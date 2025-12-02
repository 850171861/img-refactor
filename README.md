# img-refactor

Image compression + WebP conversion + reference replacement in one CLI.

## TL;DR

```
npx img-refactor run --mode replace --quality 80

Result:
- Compress all PNG/JPEG
- Convert to WebP
- Replace all code references
```

Start with `--dry` if you want to preview first:

```
npx img-refactor run --mode replace --quality 80 --dry --report json --outReport img-refactor-report.json
```

## Features

- One command pipeline: scan → compress → WebP → replace references
- Dual capability:
  - Compress originals (JPG/PNG; optional GIF/SVG) without changing type
  - Convert PNG/JPG/JPEG to WebP
- Two modes: `replace` (delete originals) or `dual` (keep originals)
- Global reference replacement for `JSX/TSX/MDX/HTML/Vue/CSS`
- Dry-run with report output (JSON/MD) and local web preview
- Large image detection with MB/KB thresholds
- Smart caching to avoid repeated lossy compression; `--forceRaster`/`--forceWebp` available
- Controls for workflow: `--skipRaster` (WebP only), `--backup` for safe compress
- Flexible input: auto-detect common dirs or provide custom glob patterns
- Config file support with CLI override
## Why

- Reduce image payload with automated compression
- Ship modern formats (WebP) with optional fallback
- Update imports/paths across code (JSX/TSX/MDX/HTML/Vue/CSS)
- Safe dry-run and large file detection to catch issues early

## Install & Use

- Global: `npx img-refactor run`
- Local install:

```
npm i -D img-refactor
npx img-refactor run
```

## Commands

- `img-refactor run`
  - Compress + convert to WebP + replace references
  - Modes:
    - `replace`: delete original, keep `.webp`, auto replace references
    - `dual`: keep original + generate `.webp`, `--replaceRefs` controls reference update

- `img-refactor compress`
  - Compress images without changing their type
  - Optional `--backup` creates `*.bak`

- `img-refactor webp`
  - Convert `png/jpg/jpeg` to WebP and update references
  - Works with `--mode replace|dual`

## Examples

```
npx img-refactor run --mode replace --quality 80
npx img-refactor run --mode dual --dry
npx img-refactor run --dirs 'public/images/**/*' 'src/assets/**/*' --gif true --svg true
npx img-refactor compress --dirs 'public/images/**/*' 'src/assets/**/*' --quality 80
npx img-refactor webp --mode replace --dirs 'public/images/**/*' 'src/assets/**/*' --quality 80
npx img-refactor run --dirs 'public/**/*' --warnMB --report json --outReport img-report.json
```

### Illustration

```
Before:
src/logo.png (320 KB)

After:
src/logo.webp (45 KB)

Refs updated in:
• src/App.tsx
• components/Header.tsx
```

## Options

- `--mode`: `replace|dual` (default: `dual`)
- `--dry`: preview only
- `--dirs`: array of glob patterns (quote globs: `'**/*'`)
- `--include`: extensions to process (default: `jpg,jpeg,png,gif,svg`)
- `--gif`: process GIF (default: `false`)
- `--svg`: optimize SVG (default: `false`)
- `--quality`: compression/WebP quality (default: `80`)
- Large file check:
  - `--warnMB`, `--errorMB` (defaults: `1`, `3`)
  - `--warnKB`, `--errorKB` (KB thresholds; take precedence when set)
- Reference replacement:
  - `--replaceRefs` (default: `true` in `replace`, `false` in `dual`)
  - `--codeGlobs` (default: `**/*.{js,jsx,ts,tsx,mdx,html,vue,css,scss}`)
  - `--ignoreGlobs` (default ignores `node_modules/dist/.next/build/coverage/.git`)
- Caching & control:
  - `--skipRaster` skip JPG/PNG compression (WebP only)
  - `--forceRaster` force recompress
  - `--forceWebp` force regenerate WebP
  - `--cacheFile` default `img-refactor.cache.json`
- Reporting:
  - `--report md|json`
  - `--outReport <path>`

## Dry Run

- Add `--dry` to any command to preview changes without writing files
- Combine with `--report` to generate an auditable summary

## Large Image Detection

- Flags images exceeding thresholds as warnings/errors in the summary
- Use KB for fine control: `--warnKB`, `--errorKB`

## Config File (optional)

- `img-refactor.config.js|json` in project root; CLI flags override config
```
module.exports = {
  dirs: ['public/images/**/*','src/assets/**/*'],
  mode: 'dual',
  replaceRefs: false,
  quality: 80
}
```

## Report & Web Preview

- Generate JSON/MD report via `--report`
- Preview locally:
  - `node ./node_modules/img-refactor/bin/serve-report.js --file img-refactor-report.json --port 8080`
  - Open `http://localhost:8080/`


## Collaboration & Caching

- Commit `img-refactor.cache.json` to avoid repeated lossy compression across dev machines
- Prefer `--skipRaster` if your team primarily ships WebP

## Notes

- GIF optimize is off by default; converting to WebP may drop animation
- Quote globs to avoid shell expansion: `'public/images/**/*'`
