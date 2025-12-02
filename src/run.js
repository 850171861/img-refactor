const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const fg = require("fast-glob");
const crypto = require("crypto");
const sharp = require("sharp");
const { optimize: svgoOptimize } = require("svgo");

function toPosix(p) {
  return p.split(path.sep).join("/");
}
function bytesToMB(b) {
  return b / (1024 * 1024);
}
function defaultDirs(cwd) {
  const base = ["public/images", "public/assets", "src/assets"];
  const exist = base.filter((d) => fs.existsSync(path.join(cwd, d)));
  return exist.map((d) => `${d}/**/*`);
}

async function hashFile(file) {
  const buf = await fsp.readFile(file);
  return crypto.createHash("sha1").update(buf).digest("hex");
}

function loadCache(cwd, cacheFile) {
  const p = path.join(cwd, cacheFile);
  if (!fs.existsSync(p)) return {};
  try {
    const txt = fs.readFileSync(p, "utf8");
    const obj = JSON.parse(txt);
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    return {};
  }
}

async function saveCache(cwd, cacheFile, data) {
  const p = path.join(cwd, cacheFile);
  await fsp.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

function listImages(cwd, dirs) {
  return fg
    .sync(dirs, { cwd, onlyFiles: true, dot: false, followSymbolicLinks: true })
    .map((p) => path.join(cwd, p));
}

function filterByExt(files, includeExts, opt) {
  const allowed = includeExts.map((e) => e.toLowerCase());
  return files.filter((f) => {
    const ext = path.extname(f).slice(1).toLowerCase();
    if (ext === "gif" && !opt.gif) return false;
    if (ext === "svg" && !opt.svg) return false;
    return allowed.includes(ext);
  });
}

async function getFileInfo(file) {
  const st = await fsp.stat(file);
  return { file, size: st.size };
}

function webpPathFor(file) {
  const dir = path.dirname(file);
  const base = path.basename(file, path.extname(file));
  return path.join(dir, base + ".webp");
}

async function compressRaster(input, ext, quality) {
  const img = sharp(input);
  if (ext === "png") return img.png({ quality }).toBuffer();
  if (ext === "jpg" || ext === "jpeg") return img.jpeg({ quality }).toBuffer();
  if (ext === "gif") return img.toBuffer();
  return img.toBuffer();
}

async function convertToWebp(input, quality, outPath) {
  await sharp(input).webp({ quality }).toFile(outPath);
}

async function optimizeSvg(input) {
  const content = await fsp.readFile(input, "utf8");
  const res = svgoOptimize(content, { multipass: true });
  return res.data;
}

function buildMapping(cwd, originals) {
  const map = new Map();
  for (const orig of originals) {
    const rel = toPosix(path.relative(cwd, orig));
    const out = webpPathFor(orig);
    const relOut = toPosix(path.relative(cwd, out));
    map.set(rel, relOut);
  }
  return map;
}

function replaceInContent(content, map) {
  let changed = false;
  for (const [origRel, webpRel] of map.entries()) {
    const exts = [".png", ".jpg", ".jpeg", ".gif", ".svg"];
    for (const e of exts) {
      if (origRel.endsWith(e)) {
        const reEsc = origRel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(reEsc, "g");
        if (re.test(content)) {
          content = content.replace(re, webpRel);
          changed = true;
        }
        const fileName = path.basename(origRel);
        const feEsc = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re2 = new RegExp(feEsc, "g");
        if (re2.test(content)) {
          content = content.replace(re2, path.basename(webpRel));
          changed = true;
        }
      }
    }
  }
  return { content, changed };
}

async function replaceReferences(cwd, map, codeGlobs, ignoreGlobs, dry) {
  const files = fg.sync(codeGlobs, {
    cwd,
    ignore: ignoreGlobs,
    onlyFiles: true,
    dot: true,
    followSymbolicLinks: true,
  });
  let count = 0;
  for (const rel of files) {
    const abs = path.join(cwd, rel);
    const content = await fsp.readFile(abs, "utf8");
    const res = replaceInContent(content, map);
    if (res.changed) {
      count++;
      if (!dry) await fsp.writeFile(abs, res.content, "utf8");
    }
  }
  return count;
}

async function run(opts) {
  const cwd = process.cwd();
  const dirs = opts.dirs && opts.dirs.length ? opts.dirs : defaultDirs(cwd);
  const includeExts = (opts.include || "jpg,jpeg,png,gif,svg")
    .split(",")
    .map((s) => s.trim());
  const allImages = listImages(cwd, dirs);
  const images = filterByExt(allImages, includeExts, opts);
  const cacheFile = opts.cacheFile || "img-refactor.cache.json";
  const cache = loadCache(cwd, cacheFile);
  const infos = await Promise.all(images.map(getFileInfo));
  const warnBytes =
    typeof opts.warnKB === "number" && opts.warnKB > 0
      ? Math.round(opts.warnKB * 1024)
      : Math.round((opts.warnMB || 1) * 1024 * 1024);
  const errorBytes =
    typeof opts.errorKB === "number" && opts.errorKB > 0
      ? Math.round(opts.errorKB * 1024)
      : Math.round((opts.errorMB || 3) * 1024 * 1024);
  const warnings = [];
  const errors = [];
  for (const info of infos) {
    if (info.size >= errorBytes) errors.push(info);
    else if (info.size >= warnBytes) warnings.push(info);
  }
  const sizeBefore = new Map(infos.map((i) => [i.file, i.size]));
  const processed = [];
  const compressedFiles = [];
  const webpFiles = [];
  let skippedRaster = 0;
  let skippedWebp = 0;
  const doWebp =
    opts.action === "webp" ||
    (typeof opts.action === "undefined" &&
      (opts.mode === "replace" || opts.mode === "dual"));
  for (const file of images) {
    const ext = path.extname(file).slice(1).toLowerCase();
    if (ext === "svg") {
      if (opts.svg) {
        const min = await optimizeSvg(file);
        if (!opts.dry) await fsp.writeFile(file, min, "utf8");
        processed.push(file);
      }
      continue;
    }
    if (ext === "gif" && !opts.gif) {
      continue;
    }
    const quality = opts.quality || 80;
    const webpOut = webpPathFor(file);
    const relKey = toPosix(path.relative(cwd, file));
    const currentHash = await hashFile(file);
    const entry = cache[relKey] || {};
    const rasterCandidate = ext === "png" || ext === "jpg" || ext === "jpeg";
    const needRaster =
      rasterCandidate &&
      !opts.skipRaster &&
      (opts.forceRaster || entry.rasterHash !== currentHash);
    if (!opts.dry) {
      if (needRaster) {
        if (opts.backup) {
          const backupPath = file + ".bak";
          const existsBackup = await fsp
            .access(backupPath)
            .then(() => true)
            .catch(() => false);
          if (!existsBackup) {
            await fsp.copyFile(file, backupPath);
          }
        }
        try {
          const buf = await compressRaster(file, ext, quality);
          await fsp.writeFile(file, buf);
          const afterStat = await fsp.stat(file);
          const before = sizeBefore.get(file) || 0;
          const after = afterStat.size;
          compressedFiles.push({
            file: toPosix(path.relative(cwd, file)),
            beforeMB: +bytesToMB(before).toFixed(2),
            afterMB: +bytesToMB(after).toFixed(2),
            savedMB: +bytesToMB(Math.max(before - after, 0)).toFixed(2),
          });
          const newHash = await hashFile(file);
          cache[relKey] = Object.assign({}, entry, { rasterHash: newHash });
        } catch (e) {}
      } else {
        skippedRaster++;
      }
      const exists = await fsp
        .access(webpOut)
        .then(() => true)
        .catch(() => false);
      const webpCandidate = rasterCandidate;
      const needWebp =
        doWebp &&
        webpCandidate &&
        (opts.forceWebp || !exists || entry.webpSourceHash !== currentHash);
      if (needWebp) {
        try {
          await convertToWebp(file, quality, webpOut);
          webpFiles.push(toPosix(path.relative(cwd, webpOut)));
          cache[relKey] = Object.assign({}, cache[relKey] || {}, {
            webpSourceHash: currentHash,
          });
        } catch (e) {
          skippedWebp++;
        }
      } else if (doWebp) {
        skippedWebp++;
      }
      if (opts.mode === "replace" && doWebp) {
        await fsp.rm(file);
      }
    }
    processed.push(file);
  }
  if (!opts.dry) {
    await saveCache(cwd, cacheFile, cache);
  }
  const map = buildMapping(cwd, images);
  let replacedFiles = 0;
  let changedCodeFiles = [];
  const shouldReplaceRefs =
    typeof opts.replaceRefs === "boolean"
      ? opts.replaceRefs
      : opts.mode === "replace";
  if (shouldReplaceRefs) {
    const files = fg.sync(
      opts.codeGlobs || ["**/*.{js,jsx,ts,tsx,mdx,html,vue,css,scss}"],
      {
        cwd,
        ignore: opts.ignoreGlobs || [
          "**/node_modules/**",
          "**/dist/**",
          "**/.next/**",
          "**/build/**",
          "**/coverage/**",
          "**/.git/**",
        ],
        onlyFiles: true,
        dot: true,
        followSymbolicLinks: true,
      }
    );
    for (const rel of files) {
      const abs = path.join(cwd, rel);
      const content = await fsp.readFile(abs, "utf8");
      const res = replaceInContent(content, map);
      if (res.changed) {
        replacedFiles++;
        changedCodeFiles.push(rel);
        if (!opts.dry) await fsp.writeFile(abs, res.content, "utf8");
      }
    }
  }
  const totalSavedMB = compressedFiles.reduce((sum, i) => sum + i.savedMB, 0);
  const summary = {
    totalFound: images.length,
    processed: processed.length,
    refsUpdated: replacedFiles,
    action: doWebp ? "webp" : "compress",
    compressed: compressedFiles,
    webpGenerated: webpFiles,
    codeModified: changedCodeFiles,
    totalSavedMB: +Number(totalSavedMB).toFixed(2),
    skippedRaster,
    skippedWebp,
    warnings: warnings.map((i) => ({
      file: toPosix(path.relative(cwd, i.file)),
      sizeMB: +bytesToMB(i.size).toFixed(2),
    })),
    errors: errors.map((i) => ({
      file: toPosix(path.relative(cwd, i.file)),
      sizeMB: +bytesToMB(i.size).toFixed(2),
    })),
    mode: opts.mode,
    dry: !!opts.dry,
  };
  return summary;
}

module.exports = { run };
