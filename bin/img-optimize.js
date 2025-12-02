#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { run } = require("../src/run");

function loadConfig(cwd) {
  const jsPath = path.join(cwd, "img-optimize.config.js");
  const jsonPath = path.join(cwd, "img-optimize.config.json");
  if (fs.existsSync(jsPath)) {
    const cfg = require(jsPath);
    return typeof cfg === "function" ? cfg() : cfg;
  }
  if (fs.existsSync(jsonPath)) {
    const text = fs.readFileSync(jsonPath, "utf8");
    try {
      return JSON.parse(text);
    } catch (e) {
      return {};
    }
  }
  return {};
}

function toMd(summary) {
  const lines = [];
  lines.push(`# img-optimize report`);
  lines.push(`- totalFound: ${summary.totalFound}`);
  lines.push(`- processed: ${summary.processed}`);
  lines.push(`- refsUpdated: ${summary.refsUpdated}`);
  lines.push(`- mode: ${summary.mode}`);
  lines.push(`- dry: ${summary.dry}`);
  if (summary.warnings.length) {
    lines.push(`\n## warnings`);
    for (const w of summary.warnings) {
      lines.push(`- ${w.file} (${w.sizeMB} MB)`);
    }
  }
  if (summary.errors.length) {
    lines.push(`\n## errors`);
    for (const e of summary.errors) {
      lines.push(`- ${e.file} (${e.sizeMB} MB)`);
    }
  }
  return lines.join("\n");
}

yargs(hideBin(process.argv))
  .scriptName("img-refactor")
  .command(
    "run",
    "Scan, compress, convert to WebP, replace references",
    (y) => {
      return y
        .option("dry", { type: "boolean", default: false })
        .option("mode", {
          type: "string",
          choices: ["replace", "dual"],
          default: "dual",
        })
        .option("dirs", { type: "array" })
        .option("include", { type: "string", default: "jpg,jpeg,png,gif,svg" })
        .option("gif", { type: "boolean", default: false })
        .option("svg", { type: "boolean", default: false })
        .option("quality", { type: "number", default: 80 })
        .option("warnMB", { type: "number", default: 1 })
        .option("errorMB", { type: "number", default: 3 })
        .option("warnKB", { type: "number" })
        .option("errorKB", { type: "number" })
        .option("replaceRefs", { type: "boolean" })
        .option("codeGlobs", { type: "array" })
        .option("ignoreGlobs", { type: "array" })
        .option("forceRaster", { type: "boolean", default: false })
        .option("forceWebp", { type: "boolean", default: false })
        .option("skipRaster", { type: "boolean", default: false })
        .option("cacheFile", {
          type: "string",
          default: "img-optimize.cache.json",
        })
        .option("report", { type: "string", choices: ["json", "md"] })
        .option("outReport", { type: "string" });
    },
    async (args) => {
      const cwd = process.cwd();
      const cfg = loadConfig(cwd);
      const merged = Object.assign({}, cfg || {}, args);
      const res = await run(merged);
      if (args.report) {
        const mode = args.report;
        if (mode === "json") {
          const out =
            args.outReport || path.join(cwd, "img-refactor-report.json");
          await fsp.writeFile(out, JSON.stringify(res, null, 2), "utf8");
          console.log(out);
        } else {
          const out =
            args.outReport || path.join(cwd, "img-refactor-report.md");
          await fsp.writeFile(out, toMd(res), "utf8");
          console.log(out);
        }
      } else {
        console.log(JSON.stringify(res, null, 2));
      }
    }
  )
  .command(
    "compress",
    "Compress images without changing type",
    (y) => {
      return y
        .option("dry", { type: "boolean", default: false })
        .option("dirs", { type: "array" })
        .option("include", { type: "string", default: "jpg,jpeg,png,gif,svg" })
        .option("gif", { type: "boolean", default: false })
        .option("svg", { type: "boolean", default: false })
        .option("quality", { type: "number", default: 80 })
        .option("warnMB", { type: "number", default: 1 })
        .option("errorMB", { type: "number", default: 3 })
        .option("warnKB", { type: "number" })
        .option("errorKB", { type: "number" })
        .option("backup", { type: "boolean", default: false })
        .option("forceRaster", { type: "boolean", default: false })
        .option("cacheFile", {
          type: "string",
          default: "img-optimize.cache.json",
        })
        .option("report", { type: "string", choices: ["json", "md"] })
        .option("outReport", { type: "string" });
    },
    async (args) => {
      const cwd = process.cwd();
      const cfg = loadConfig(cwd);
      const merged = Object.assign({}, cfg || {}, args, {
        action: "compress",
        mode: "dual",
        replaceRefs: false,
      });
      const res = await run(merged);
      const out = args.outReport || path.join(cwd, "img-refactor-report.json");
      await fsp.writeFile(out, JSON.stringify(res, null, 2), "utf8");
      console.log(out);
    }
  )
  .command(
    "webp",
    "Convert PNG/JPG to WebP and update references",
    (y) => {
      return y
        .option("dry", { type: "boolean", default: false })
        .option("mode", {
          type: "string",
          choices: ["replace", "dual"],
          default: "replace",
        })
        .option("dirs", { type: "array" })
        .option("include", { type: "string", default: "jpg,jpeg,png" })
        .option("quality", { type: "number", default: 80 })
        .option("warnMB", { type: "number", default: 1 })
        .option("errorMB", { type: "number", default: 3 })
        .option("warnKB", { type: "number" })
        .option("errorKB", { type: "number" })
        .option("replaceRefs", { type: "boolean" })
        .option("codeGlobs", { type: "array" })
        .option("ignoreGlobs", { type: "array" })
        .option("forceWebp", { type: "boolean", default: false })
        .option("cacheFile", {
          type: "string",
          default: "img-optimize.cache.json",
        })
        .option("report", { type: "string", choices: ["json", "md"] })
        .option("outReport", { type: "string" });
    },
    async (args) => {
      const cwd = process.cwd();
      const cfg = loadConfig(cwd);
      const merged = Object.assign({}, cfg || {}, args, {
        action: "webp",
        replaceRefs:
          typeof args.replaceRefs === "boolean"
            ? args.replaceRefs
            : args.mode === "replace",
      });
      const res = await run(merged);
      const out = args.outReport || path.join(cwd, "img-refactor-report.json");
      await fsp.writeFile(out, JSON.stringify(res, null, 2), "utf8");
      console.log(out);
    }
  )
  .demandCommand(1)
  .help()
  .alias("h", "help")
  .parse();
