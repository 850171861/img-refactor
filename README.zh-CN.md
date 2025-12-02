# img-refactor

一个命令完成图片压缩 + WebP 转换 + 引用替换。

## 为什么需要

- 自动压缩，降低图片体积
- 生成 WebP（可选保留原图或删除原图）
- 全局替换引用路径（`JSX/TSX/MDX/HTML/Vue/CSS`）
- 干跑与超大图检查保障安全

## 安装与使用

- 全局运行：`npx img-refactor run`
- 本地安装：

```
npm i -D img-refactor
npx img-refactor run
```

## 命令

- `img-refactor run`
  - 压缩 + 转 WebP + 替换引用
  - 模式：
    - `replace`：删除原图、保留 `.webp`，自动替换引用
    - `dual`：保留原图并生成 `.webp`，`--replaceRefs` 控制是否替换引用

- `img-refactor compress`
  - 仅压缩体积，不改变文件类型
  - 可选 `--backup` 生成 `*.bak`

- `img-refactor webp`
  - 将 `png/jpg/jpeg` 转为 WebP 并更新引用
  - 支持 `--mode replace|dual`

## 示例

```
npx img-refactor run --mode replace --quality 80
npx img-refactor run --mode dual --dry
npx img-refactor run --dirs 'public/images/**/*' 'src/assets/**/*' --gif true --svg true
npx img-refactor compress --dirs 'public/images/**/*' 'src/assets/**/*' --quality 80
npx img-refactor webp --mode replace --dirs 'public/images/**/*' 'src/assets/**/*' --quality 80
npx img-refactor run --dirs 'public/**/*' --warnMB --report json --outReport img-report.json
```

## 可选项

- `--mode`：`replace|dual`，默认 `dual`
- `--dry`：仅预览不改动
- `--dirs`：数组，自定义扫描目录（注意对 glob 加引号）
- `--include`：扩展名白名单，默认 `jpg,jpeg,png,gif,svg`
- `--gif`：是否处理 GIF，默认 `false`
- `--svg`：是否压缩 SVG，默认 `false`
- `--quality`：压缩/WebP 质量，默认 `80`
- 超大图检查：
  - `--warnMB`、`--errorMB`（默认 `1`、`3`）
  - `--warnKB`、`--errorKB`（若设置，优先生效）
- 引用替换：
  - `--replaceRefs`（`replace` 默认 `true`，`dual` 默认 `false`）
  - `--codeGlobs`（默认 `**/*.{js,jsx,ts,tsx,mdx,html,vue,css,scss}`）
  - `--ignoreGlobs`（默认忽略 `node_modules/dist/.next/build/coverage/.git`）
- 缓存与控制：
  - `--skipRaster` 跳过 JPG/PNG 压缩，仅转 WebP
  - `--forceRaster` 强制重新压缩
  - `--forceWebp` 强制重新生成 WebP
  - `--cacheFile` 默认 `img-refactor.cache.json`
- 报告：
  - `--report md|json`
  - `--outReport <path>`

## 干跑

- 任意命令加 `--dry` 进行预览
- 配合 `--report` 输出审阅用报表

## 报告与网页预览

- 生成 JSON/MD 报告：`--report`、`--outReport`
- 本地预览：
  - `node ./node_modules/img-refactor/bin/serve-report.js --file img-refactor-report.json --port 8080`
  - 打开 `http://localhost:8080/`

## 本地测试（未发布）

- 路径安装：`npm i -D "file:/绝对路径/到/项目"`
- npm link：插件目录 `npm link`；项目目录 `npm link img-refactor`
- tarball：插件目录 `npm pack`；项目安装 `npm i -D ./img-refactor-0.1.0.tgz`

## 协作与缓存

- 提交 `img-refactor.cache.json`，避免重复有损压缩
- 团队主推 WebP 时建议默认 `--skipRaster`

## 注意

- 默认不压缩 GIF；转 WebP 可能丢失动画
- 对 glob 加引号：`'public/images/**/*'`，避免 shell 预展开
