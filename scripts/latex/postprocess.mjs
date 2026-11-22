#!/usr/bin/env node
// latex-out -> content/notes/<slug>/（page bundle）+ assets/notes/<slug>/body.html
//
// 1. 清洗 tex4ht 产物：修 ctex 造成的畸形/未闭合标签、删 MathJax CDN、去掉页眉横线
// 2. 用 KaTeX 的 mathml 输出替换 \( ... \) 与 \[ ... \]（构建期完成，页面零 JS）
// 3. 图片搬到 static/notes/<slug>/，\stagenum 这类"排版用位图"换成文字
// 4. 生成 Hugo 页面：index.md（仅 frontmatter）+ body.html + toc.html

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import katex from "katex"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "..", "..")
const LATEX_OUT = path.join(ROOT, "latex-out")
const CONTENT = path.join(ROOT, "content")

// preamble.tex 里自定义、KaTeX 不认识的宏
const MACROS = {
  "\\abs": "\\left|#1\\right|",
  "\\norm": "\\left\\lVert #1\\right\\rVert",
  "\\paren": "\\left(#1\\right)",
  "\\sqbrk": "\\left[#1\\right]",
  "\\curlbrace": "\\left\\{#1\\right\\}",
  "\\bm": "\\boldsymbol{#1}",
  "\\KL": "\\mathrm{KL}",
  "\\GAE": "\\mathrm{GAE}",
  "\\R": "\\mathbb{E}",
}

const stats = { notes: 0, math: 0, mathFail: 0, headings: 0, images: 0 }
const failures = []

const listDirs = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : []

// ---------- 元数据 ----------

function parseMeta(tex) {
  const meta = { tags: [] }
  for (const line of tex.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = line.match(/^%\s*!\s*([a-zA-Z]+)\s*:\s*(.+)$/)
    if (m) meta[m[1].toLowerCase()] = m[2].trim()
    if (line.trim() === "\\begin{document}") break
  }
  if (!meta.title) {
    const t = tex.match(/\\title\{([\s\S]*?)\}/)
    if (t) meta.title = t[1].trim()
  }
  if (!meta.date) {
    const d = tex.match(/\\date\{([\s\S]*?)\}/)
    if (d) meta.date = d[1].trim()
  }
  if (typeof meta.tags === "string") meta.tags = meta.tags.split(",").map((s) => s.trim()).filter(Boolean)
  if (typeof meta.number === "string") meta.number = Number(meta.number) || 0
  return meta
}

function isoDate(value) {
  const m = String(value || "").match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/)
  if (!m) return new Date().toISOString().slice(0, 19) + "+08:00"
  const pad = (n) => String(n).padStart(2, "0")
  return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]) + "T09:00:00+08:00"
}

function gitLastmod(texPath) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", texPath], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return out || ""
  } catch {
    return ""
  }
}

// ---------- HTML 清洗 ----------

// ctex + tex4ht 会写出 <h3class="sectionhead">（标签名和属性之间没有空格），而且不闭合
function fixMalformedTags(html) {
  return html.replace(/<([a-zA-Z][a-zA-Z0-9]*?)(class|id|style|display|href|src|alt|title|width|height|colspan|rowspan)=/g, "<$1 $2=")
}

function closeHeadings(html) {
  const fixed = html.split("\n").map((line) => {
    const m = line.match(/^<h([2-6]) (class="[^"]*")>([\s\S]*)$/)
    if (!m || line.includes("</h")) return line
    let body = m[3]
    const open = (body.match(/<span\b/g) || []).length
    const close = (body.match(/<\/span>/g) || []).length
    body += "</span>".repeat(Math.max(0, open - close))
    return "<h" + m[1] + " " + m[2] + ">" + body + "</h" + m[1] + ">"
  })
  return fixed.join("\n")
}

function decodeTex(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

// 把 tex4ht 的行内公式包成 KaTeX 能吃的样子：
// \label / \nonumber 这类纯排版指令删掉，align/gather/equation 换成 KaTeX 支持的 aligned/gathered
function sanitizeTex(tex) {
  return tex
    .replace(/\\label\s*\{[^}]*\}/g, "")
    .replace(/\\(nonumber|notag|allowdisplaybreaks)\b/g, "")
    .replace(/\\begin\{align\*?\}/g, "\\begin{aligned}")
    .replace(/\\end\{align\*?\}/g, "\\end{aligned}")
    .replace(/\\begin\{gather\*?\}/g, "\\begin{gathered}")
    .replace(/\\end\{gather\*?\}/g, "\\end{gathered}")
    .replace(/\\begin\{equation\*?\}/g, "")
    .replace(/\\end\{equation\*?\}/g, "")
    .replace(/\\begin\{multline\*?\}/g, "")
    .replace(/\\end\{multline\*?\}/g, "")
    .replace(/\\intertext\s*\{/g, "\\text{")
}

function renderTex(tex, displayMode) {
  try {
    stats.math += 1
    return katex.renderToString(sanitizeTex(tex).trim(), {
      displayMode: displayMode,
      output: "mathml",
      throwOnError: true,
      strict: "ignore",
      macros: MACROS,
    })
  } catch (err) {
    stats.mathFail += 1
    failures.push((displayMode ? "display: " : "inline: ") + tex.slice(0, 80) + " => " + String(err.message).slice(0, 80))
    return '<code class="math-error">' + tex.replace(/</g, "&lt;") + "</code>"
  }
}

// tex4ht 偶尔会漏写公式 span 的闭合标签，导致下一段公式被吞进来。
// 遇到"两个开标签之间没有闭标签"就补一个 </span>。
function balanceMathSpans(html, openTag, closeTag) {
  let out = ""
  let i = 0
  let pending = false
  while (true) {
    const idx = html.indexOf(openTag, i)
    if (idx < 0) {
      out += html.slice(i)
      break
    }
    const segment = html.slice(i, idx)
    out += segment
    if (pending && !segment.includes(closeTag)) out += closeTag
    out += openTag
    pending = true
    i = idx + openTag.length
  }
  return out
}

// 按 <span>/<div> 的配对深度找出成对区域，避免 tex4ht 偶发漏闭合标签时把两段公式吞成一段
function replacePaired(html, openTag, tagName, render) {
  const closeTag = "</" + tagName + ">"
  let out = ""
  let i = 0
  while (i < html.length) {
    const start = html.indexOf(openTag, i)
    if (start < 0) {
      out += html.slice(i)
      break
    }
    out += html.slice(i, start)
    let depth = 1
    let j = start + openTag.length
    while (depth > 0) {
      const nextOpen = html.indexOf("<" + tagName, j)
      const nextClose = html.indexOf(closeTag, j)
      if (nextClose < 0) {
        j = html.length
        break
      }
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1
        j = nextOpen + tagName.length + 1
      } else {
        depth -= 1
        j = nextClose + closeTag.length
      }
    }
    const inner = html.slice(start + openTag.length, j - closeTag.length)
    out += render(inner)
    i = j
  }
  return out
}

function renderMath(html) {
  html = balanceMathSpans(html, "<span class='mathjax-inline'>", "</span>")
  html = balanceMathSpans(html, "<div class='mathjax-block'>", "</div>")
  html = replacePaired(html, "<span class='mathjax-inline'>", "span", (inner) => {
    let text = decodeTex(inner).replace(/^\s*\\\(/, "")
    let rest = ""
    // tex4ht 偶尔会把后续正文写进公式 span 里，遇到第一个 \) 就把剩下部分踢出去
    const close = text.indexOf("\\)")
    if (close >= 0) {
      rest = text.slice(close + 2)
      text = text.slice(0, close)
    }
    return '<span class="katex-math">' + renderTex(text, false) + "</span>" + rest
  })
  html = replacePaired(html, "<div class='mathjax-block'>", "div", (inner) => {
    const tex = decodeTex(inner).replace(/^\s*\\\[/, "").replace(/\\\]\s*$/, "")
    return '<div class="katex-display">' + renderTex(tex, true) + "</div>"
  })
  html = html.replace(/<div class='mathjax-env[^']*'>([\s\S]*?)<\/div>/g, (_m, inner) => {
    return '<div class="katex-display">' + renderTex(decodeTex(inner), true) + "</div>"
  })
  return html
}

function balanceDivs(html) {
  let depth = 0
  const tags = /<div\b|<\/div>/gi
  let match
  while ((match = tags.exec(html)) !== null) {
    depth += match[0] === "</div>" ? -1 : 1
    if (depth < 0) depth = 0
  }
  return depth > 0 ? html + "</div>".repeat(depth) : html
}

// tex4ht 把 \textcircled 之类排成小位图（note3x.png），换成文字
function replaceStageImages(html) {
  return html.replace(/<img[^>]*class='oalign'[^>]*?src='([^']*?)note(\d)x\.png'[^>]*>/g, (_m, _src, n) => {
    return '<span class="stage-num">' + n + "</span>"
  })
}

function relocateImages(html, slug, dir) {
  const staticDir = path.join(ROOT, "static", "notes", slug)
  return html.replace(/(<img[^>]*?src=)(['"])([^'"]+)\2/g, (m, pre, quote, src) => {
    if (/^(https?:|data:|\/)/.test(src)) return m
    const rel = src.replace(/^\.\//, "")
    const from = path.join(dir, rel)
    if (!fs.existsSync(from)) return m
    const target = path.join(staticDir, rel)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(from, target)
    stats.images += 1
    return pre + quote + "/notes/" + slug + "/" + rel.split(/[\\/]/).join("/") + quote
  })
}

function transform(raw, slug, dir) {
  let s = raw
  s = s.replace(/<script>[\s\S]*?window\.MathJax[\s\S]*?<\/script>/g, "")
  s = s.replace(/<script[^>]*MathJax[^>]*><\/script>/g, "")
  const bodyMatch = s.match(/<body[^>]*>([\s\S]*?)<\/body>/)
  s = bodyMatch ? bodyMatch[1] : s
  s = s.replace(/<!--[\s\S]*?-->/g, "")
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ").replace(/\r/g, "")
  s = fixMalformedTags(s)
  s = closeHeadings(s)
  s = s.replace(/<span class='ec-lmbx[^']*'>([\s\S]*?)<\/span>/g, "<strong>$1</strong>")
  s = s.replace(/<span class='ec-lmri[^']*'>([\s\S]*?)<\/span>/g, "<em>$1</em>")
  s = s.replace(/<span class='ec-lm[^']*'>([\s\S]*?)<\/span>/g, "$1")
  s = replaceStageImages(s)
  s = renderMath(s)
  // KaTeX 出的 MathML 里带 <annotation>（原始 TeX），浏览器不显示但会被搜索索引当成正文
  s = s.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "")
  s = s.replace(/<p[^>]*>[\s\r]*_{20,}[\s\r]*<\/p>/g, "")
  s = s.replace(/^\s*_{20,}\s*$/gm, "")
  s = s.replace(/<p[^>]*>\s*<\/p>/g, "")
  // tex4ht 在深层嵌套列表+自定义宏的组合下偶尔会把 </span> 当文本吐出来
  s = s.replace(/\/span&gt;/g, "")
  // LaTeX 的 \section 在 tex4ht 里是 h3，页面上当 h2 用（标题本身是 h1）
  s = s.replace(/<(\/?)h([3-5])\b/g, (m, slash, level) => "<" + slash + "@@H" + (Number(level) - 1) + "@@")
  s = s.replace(/@@H([0-9])@@/g, "h$1")
  s = relocateImages(s, slug, dir)
  s = balanceDivs(s)
  s = s.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim()
  return s
}

function buildToc(html) {
  const headings = []
  const re = /<h([2-4])([^>]*)>([\s\S]*?)<\/h\1>/g
  let m
  while ((m = re.exec(html)) !== null) {
    const text = m[3]
      .replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (!text) continue
    const idMatch = m[3].match(/id=['"]([^'"]+)['"]/) || m[2].match(/id=['"]([^'"]+)['"]/)
    headings.push({ level: Number(m[1]), text, id: idMatch ? idMatch[1] : "" })
  }
  stats.headings += headings.length
  if (headings.length < 2) return ""
  const parts = ['<ul class="note-toc-list">']
  let prev = 2
  for (const h of headings) {
    if (h.level > prev) parts.push("<ul>")
    else if (h.level < prev) parts.push("</li></ul></li>")
    const label = h.id ? '<a href="#' + h.id + '">' + h.text + "</a>" : "<span>" + h.text + "</span>"
    parts.push("<li>" + label)
    prev = h.level
  }
  parts.push("</li></ul>")
  return '<nav class="note-toc">' + parts.join("") + "</nav>"
}

const yaml = (value) => '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'

function writeNote(slug, dir) {
  const rawPath = path.join(dir, "body.raw.html")
  const texPath = path.join(dir, "main.tex")
  if (!fs.existsSync(rawPath) || !fs.existsSync(texPath)) {
    console.warn("[latex] 跳过 " + slug + "（缺少 body.raw.html 或 main.tex）")
    return
  }
  const meta = parseMeta(fs.readFileSync(texPath, "utf8"))
  const html = transform(fs.readFileSync(rawPath, "utf8"), slug, dir)
  const toc = buildToc(html)

  const assetDir = path.join(ROOT, "assets", "notes", slug)
  fs.mkdirSync(assetDir, { recursive: true })
  fs.writeFileSync(path.join(assetDir, "body.html"), '<div class="latex-note">\n' + html + "\n</div>\n", "utf8")
  if (toc) fs.writeFileSync(path.join(assetDir, "toc.html"), toc, "utf8")

  const bundle = path.join(CONTENT, "notes", slug)
  fs.mkdirSync(bundle, { recursive: true })

  const lines = ["---"]
  lines.push("title: " + yaml(meta.title || slug))
  lines.push("date: " + isoDate(meta.date))
  lines.push("lastmod: " + (gitLastmod(path.join("latex", slug, "main.tex")) || isoDate(meta.date)))
  lines.push("slug: " + yaml(slug))
  if (meta.description) lines.push("description: " + yaml(meta.description))
  if (meta.tags.length) lines.push("tags: [" + meta.tags.map(yaml).join(", ") + "]")
  if (meta.series) {
    lines.push("categories: [" + yaml(meta.series) + "]")
    lines.push("lectureSeries: " + yaml(meta.series))
  }
  if (meta.number) lines.push("lectureNumber: " + Number(meta.number))
  lines.push('articleStyle: "lecture"')
  lines.push("latex: true")
  lines.push("latexSource: " + yaml("latex/" + slug + "/main.tex"))
  lines.push("---", "")
  fs.writeFileSync(path.join(bundle, "index.md"), lines.join("\n"), "utf8")
  stats.notes += 1
}

function cleanGenerated(slugs) {
  // 整目录重建：笔记删掉图片后不会在 static/ 里留下孤儿文件
  for (const dir of [path.join(ROOT, "assets", "notes"), path.join(ROOT, "static", "notes")]) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  const notesDir = path.join(CONTENT, "notes")
  if (fs.existsSync(notesDir)) {
    for (const entry of fs.readdirSync(notesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = path.join(notesDir, entry.name)
      const index = path.join(dir, "index.md")
      if (!fs.existsSync(index)) continue
      if (/^latex:\s*true\s*$/m.test(fs.readFileSync(index, "utf8"))) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  }
  for (const base of [path.join(ROOT, "assets", "notes"), path.join(ROOT, "static", "notes")]) {
    if (!fs.existsSync(base)) continue
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() && !slugs.has(entry.name)) {
        fs.rmSync(path.join(base, entry.name), { recursive: true, force: true })
      }
    }
  }
}

function main() {
  if (listDirs(LATEX_OUT).length === 0) {
    console.error("[latex] latex-out 是空的，请先运行 scripts/latex/compile.mjs")
    process.exit(1)
  }
  const slugs = new Set(listDirs(LATEX_OUT))
  cleanGenerated(slugs)
  for (const slug of slugs) writeNote(slug, path.join(LATEX_OUT, slug))
  console.log(
    "[latex] 页面 " + stats.notes + " 篇，公式 " + stats.math + " 个，失败 " + stats.mathFail +
      " 个，图片 " + stats.images + " 张，目录项 " + stats.headings + " 个",
  )
  if (failures.length) {
    console.warn("[latex] 公式渲染失败样例：")
    for (const f of failures.slice(0, 10)) console.warn("  - " + f)
  }
}

main()