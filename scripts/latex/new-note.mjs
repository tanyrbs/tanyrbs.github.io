#!/usr/bin/env node
// 新建一篇 LaTeX 笔记：latex/<slug>/{main.tex,preamble.tex}
//
// 用法：
//   npm run note:new -- rl-dpo --title "DPO 推导" --series "强化学习" --number 3 \
//        --tags "强化学习,DPO" --description "一句话摘要"
//
// 只创建文件，不编译。编译走 npm run notes，或直接 git push 交给 CI。

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "..", "..")
const TEMPLATE = path.join(HERE, "template")
const NOTES = path.join(ROOT, "latex")

const args = process.argv.slice(2)
const flags = {}
const positional = []
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg.startsWith("--")) {
    flags[arg.slice(2)] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : ""
  } else {
    positional.push(arg)
  }
}

const slug = (positional[0] || flags.slug || "").trim()
if (!slug) {
  console.error("用法：npm run note:new -- <slug> --title \"标题\" [--series 系列] [--number 1] [--tags a,b] [--description \"摘要\"]")
  process.exit(1)
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("[note:new] slug 只能用小写字母、数字和连字符，例如 rl-dpo")
  process.exit(1)
}

const dest = path.join(NOTES, slug)
if (fs.existsSync(dest)) {
  console.error("[note:new] latex/" + slug + " 已经存在了")
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)
const meta = {
  title: flags.title || slug,
  date: flags.date || today,
  slug,
  series: flags.series || "",
  number: flags.number || "",
  tags: flags.tags || "",
  description: flags.description || "一句话摘要，会显示在列表和搜索结果里。",
}

const header = [
  "%! title: " + meta.title,
  "%! date: " + meta.date,
  "%! slug: " + meta.slug,
]
if (meta.series) header.push("%! series: " + meta.series)
if (meta.number) header.push("%! number: " + meta.number)
if (meta.tags) header.push("%! tags: " + meta.tags)
header.push("%! description: " + meta.description)

const template = fs.readFileSync(path.join(TEMPLATE, "main.tex"), "utf8")
const body = template.replace(/__TITLE__/g, meta.title)

fs.mkdirSync(dest, { recursive: true })
fs.writeFileSync(path.join(dest, "main.tex"), header.join("\n") + "\n" + body, "utf8")
fs.copyFileSync(path.join(TEMPLATE, "preamble.tex"), path.join(dest, "preamble.tex"))
fs.mkdirSync(path.join(dest, "figures"), { recursive: true })
fs.writeFileSync(path.join(dest, "figures", ".gitkeep"), "", "utf8")

console.log("[note:new] 已创建 latex/" + slug + "/")
console.log("           main.tex      " + meta.title)
console.log("           preamble.tex  从模板复制，可按需增删宏包")
console.log("           figures/      插图放这里，用 \\includegraphics{figures/x.png}")
console.log("")
console.log("下一步：")
console.log("  本地预览  npm run publish           （需要 TeX Live）")
console.log("  直接发布  git add latex/" + slug + " && git commit -m \"add note\" && git push")
console.log("            CI 会用 texlive 容器编译并部署，约 2–4 分钟")
