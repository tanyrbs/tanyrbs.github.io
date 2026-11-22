#!/usr/bin/env node
// 跨平台调用 Hugo：优先 HUGO 环境变量，其次 PATH，最后找个常见的本地路径。
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "..")

const candidates = [
  process.env.HUGO,
  "hugo",
  path.resolve(ROOT, "..", "tools", "hugo", "hugo.exe"),
  "C:\\Program Files\\Hugo\\hugo.exe",
].filter(Boolean)

const args = process.argv.slice(2)

for (const candidate of candidates) {
  if (candidate !== "hugo" && !fs.existsSync(candidate)) continue
  try {
    execFileSync(candidate, ["version"], { stdio: "ignore" })
  } catch {
    continue
  }
  try {
    execFileSync(candidate, args, { cwd: ROOT, stdio: "inherit" })
    process.exit(0)
  } catch (err) {
    process.exit(err.status || 1)
  }
}

console.error("[hugo] 找不到 hugo。装好 Hugo Extended 后加进 PATH，或设置环境变量 HUGO 指向可执行文件。")
process.exit(1)
