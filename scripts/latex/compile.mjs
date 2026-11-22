#!/usr/bin/env node
// 编译 latex/<lang>/<slug>/main.tex -> latex-out/<lang>/<slug>/body.raw.html
//
// 为什么要用 Node 而不是 bash：这台机器和 CI 都要能跑，bash 在 Windows 上不稳。
// 中文必须走 LuaLaTeX（-l）：XeLaTeX/pdfLaTeX 模式会静默丢掉中文正文，所以这里还带一个断言。

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "..", "..")
const SRC = path.join(ROOT, "latex")
const OUT = path.join(ROOT, "latex-out")
const MATH_OPT = process.env.LATEX_MATH_OPT || "mathjax"

function hasCommand(cmd) {
  try {
    execFileSync(cmd, ["--version"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
}

function cjkCount(text) {
  const m = text.match(/[\u3400-\u9fff]/g)
  return m ? m.length : 0
}

function compileOne(slug) {
  const srcDir = path.join(SRC, slug)
  const texPath = path.join(srcDir, "main.tex")
  if (!fs.existsSync(texPath)) return { ok: false, reason: "缺少 main.tex" }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "note-"))
  const dest = path.join(OUT, slug)
  fs.mkdirSync(dest, { recursive: true })
  let log = ""
  try {
    fs.cpSync(srcDir, work, { recursive: true })
    const texFile = path.join(work, "note.tex")
    fs.renameSync(path.join(work, "main.tex"), texFile)
    // tex4ht 会把 align 里的双反斜杠加方括号（行距参数）读成 display math 的开始，导致整个文档解析失败。
    // 网页里这点行距无所谓，编译前统一去掉。
    let tex = fs.readFileSync(texFile, "utf8")
    tex = tex.replace(/\\\\\s*\[[^\]]*\]/g, "\\\\")
    fs.writeFileSync(texFile, tex, "utf8")
    try {
      execFileSync("make4ht", ["-l", "-f", "html5", "-d", "html", "note.tex", MATH_OPT], {
        cwd: work,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      })
    } catch (err) {
      log = String(err.stdout || "") + String(err.stderr || "")
    }
    const htmlPath = path.join(work, "html", "note.html")
    if (!fs.existsSync(htmlPath)) {
      fs.writeFileSync(path.join(dest, "build.log"), log, "utf8")
      return { ok: false, reason: "make4ht 没有产出 note.html（见 build.log）" }
    }
    const html = fs.readFileSync(htmlPath, "utf8")
    fs.writeFileSync(path.join(dest, "body.raw.html"), html, "utf8")
    for (const entry of fs.readdirSync(path.join(work, "html"))) {
      if (entry === "note.html") continue
      fs.cpSync(path.join(work, "html", entry), path.join(dest, entry), { recursive: true })
    }
    fs.copyFileSync(texPath, path.join(dest, "main.tex"))
    if (log) fs.writeFileSync(path.join(dest, "build.log"), log, "utf8")

    // 断言：中文没被丢掉
    const cjk = cjkCount(html.replace(/<[^>]*>/g, ""))
    if (cjk < 50) return { ok: false, reason: "产物里中文只剩 " + cjk + " 字，引擎或字体有问题" }
    return { ok: true, cjk, bytes: html.length }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

function main() {
  if (!hasCommand("make4ht")) {
    console.error("[latex] 找不到 make4ht，请安装 TeX Live（含 tex4ht）")
    process.exit(1)
  }
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })

  let failed = 0
  let count = 0
  for (const slug of listDirs(SRC)) {
    {
      count += 1
      process.stdout.write("[latex] 编译 " + slug + " ... ")
      const r = compileOne(slug)
      if (r.ok) {
        console.log("ok（" + r.cjk + " 汉字，" + Math.round(r.bytes / 1024) + " KB）")
      } else {
        failed += 1
        console.log("失败：" + r.reason)
      }
    }
  }
  console.log("[latex] 共 " + count + " 篇，失败 " + failed + " 篇")
  if (failed > 0) process.exit(1)
}

main()