#!/usr/bin/env node
// latex-out -> content/<lang>/notes/<slug>/（page bundle）
//
// 1. 清洗 tex4ht 产物：修 ctex 造成的畸形/未闭合标题标签、删 MathJax CDN、删标题块与页眉线
// 2. 用 KaTeX 的 mathml 输出替换 \( ... \) 与 \[ ... \]（构建期完成，页面零 JS）
// 3. 生成 Hugo 页面：index.md（仅 frontmatter）+ body.html + toc.html

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import katex from "katex"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "..", "..")
const LATEX_OUT = path.join(ROOT, "latex-out")
const CONTENT = path.join(ROOT, "content")

// preamble.tex 里自定义的宏，KaTeX 不认识，这里补上
const MACROS = {
  "\\abs": "\\left|#1\\right|",
  "\\norm": "\\left\\lVert #1\\right\\rVert",
  "\\paren": "\\left(#1\\right)",
  "\\sqbrk": "\\left[#1\\right]",
  "\\curlbrace": "\\left\\{#1\\right\\}",
  "\\bm": "\\boldsymbol{#1}",
}

const stats = { notes: 0, math: 0, mathFail: 0, headings: 0 }
const failures = []

function listDirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
}

function cleanGenerated() {
  const notesDir = path.join(CONTENT, "notes")
  if (!fs.existsSync(notesDir)) return
  for (const entry of fs.readdirSync(notesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(notesDir, entry.name)
    const index = path.join(dir, "index.md")
    if (!fs.existsSync(index)) continue
    const text = fs.readFileSync(index, "utf8")
    if (/^latex:\s*true\s*$/m.test(text)) fs.rmSync(dir, { recursive: true, force: true })
  }
}

function parseMeta(tex) {
  const meta = { tags: [] }
  const lines = tex.replace(/^\uFEFF/, "").split(/\r?\n/)
  for (const line of lines) {
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
  if (typeof meta.tags === "string") {
    meta.tags = meta.tags.split(",").map((s) => s.trim()).filter(Boolean)
  }
  if (typeof meta.number === "string") meta.number = Number(meta.number) || 0
  return meta
}

function isoDate(value) {
  const m = String(value || "").match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/)
  if (!m) return new Date().toISOString().slice(0, 19) + "+08:00"
  const pad = (n) => String(n).padStart(2, "0")
  return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]) + "T09:00:00+08:00"
}

// ctex + tex4ht 会把标题写成 <h3class="sectionhead"><spanclass="titlemark" id='x'>1 ... 且不闭合标签
function fixHeadings(html) {
  let out = html.replace(/<h([2-6])class="/g, '<h$1 class="')
  out = out.replace(/<spanclass="/g, '<span class="')
  // ctex + tex4ht 还会吐出带属性的畸形闭合标签，例如 </h4class="subsectionhead">
  // 和 </spanclass="titlemark">。浏览器会把它们当成真实闭合标签，把 .latex-note
  // 容器提前关掉，后面所有公式就失去样式。这里统一删掉，闭合标签由下面的逻辑补。
  out = out.replace(/<\/(h[2-6]|span)class=("[^"]*"|'[^']*')>/g, "")
  const lines = out.split("\n")
  const fixed = lines.map((line) => {
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

function renderMath(html) {
  html = html.replace(/<span class='mathjax-inline'>([\s\S]*?)<\/span>/g, (m, body) => {
    const tex = decodeTex(body).replace(/^\s*\\\(/, "").replace(/\\\)\s*$/, "")
    try {
      stats.math += 1
      return '<span class="katex-math">' + katex.renderToString(tex, {
        displayMode: false,
        output: "mathml",
        throwOnError: true,
        strict: "ignore",
        macros: MACROS,
      }) + "</span>"
    } catch (err) {
      stats.mathFail += 1
      failures.push("inline: " + tex.slice(0, 90) + " => " + String(err.message).slice(0, 90))
      return '<code class="math-error">' + body + "</code>"
    }
  })
  html = html.replace(/<div class='mathjax-block'>([\s\S]*?)<\/div>/g, (m, body) => {
    const tex = decodeTex(body).replace(/^\s*\\\[/, "").replace(/\\\]\s*$/, "")
    try {
      stats.math += 1
      return '<div class="katex-display">' + katex.renderToString(tex, {
        displayMode: true,
        output: "mathml",
        throwOnError: true,
        strict: "ignore",
        macros: MACROS,
      }) + "</div>"
    } catch (err) {
      stats.mathFail += 1
      failures.push("display: " + tex.slice(0, 90) + " => " + String(err.message).slice(0, 90))
      return '<pre class="math-error">' + body + "</pre>"
    }
  })
  // align / gather 等环境 tex4ht 输出成 mathjax-env，而不是 mathjax-block
  html = html.replace(/<div class='mathjax-env[^']*'>([\s\S]*?)<\/div>/g, (m, body) => {
    const tex = decodeTex(body).trim()
    try {
      stats.math += 1
      return '<div class="katex-display">' + katex.renderToString(tex, {
        displayMode: true,
        output: "mathml",
        throwOnError: true,
        strict: "ignore",
        macros: MACROS,
      }) + "</div>"
    } catch (err) {
      stats.mathFail += 1
      failures.push("environment: " + tex.slice(0, 90) + " => " + String(err.message).slice(0, 90))
      return '<pre class="math-error">' + body + "</pre>"
    }
  })
  return html
}

function removeTitleCenter(html) {
  const open = /<div\b[^>]*class=(?:"[^"]*\bcenter\b[^"]*"|'[^']*\bcenter\b[^']*')[^>]*>/i.exec(html)
  if (!open) return html
  const firstHeading = html.search(/<h[2-6]\b/i)
  if (firstHeading !== -1 && open.index > firstHeading) return html

  const tags = /<div\b|<\/div>/gi
  tags.lastIndex = open.index
  let depth = 0
  let match
  while ((match = tags.exec(html)) !== null) {
    if (match[0] === "</div>") depth -= 1
    else depth += 1
    if (depth === 0) {
      const block = html.slice(open.index, match.index + match[0].length)
      // 只删标题块；正文里用 center 包起来的表格/图要保留
      if (/<table\b/i.test(block)) return html
      return html.slice(0, open.index) + html.slice(match.index + match[0].length)
    }
  }
  return html
}

function transform(raw) {
  let s = raw
  s = s.replace(/<script>[\s\S]*?window\.MathJax[\s\S]*?<\/script>/g, "")
  s = s.replace(/<script[^>]*MathJax[^>]*><\/script>/g, "")
  const bodyMatch = s.match(/<body[^>]*>([\s\S]*?)<\/body>/)
  s = bodyMatch ? bodyMatch[1] : s
  s = s.replace(/<!--[\s\S]*?-->/g, "")
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ").replace(/\r/g, "")
  s = fixHeadings(s)
  s = s.replace(/<span class='ec-lmbx[^']*'>([\s\S]*?)<\/span>/g, "<strong>$1</strong>")
  s = s.replace(/<span class='ec-lmri[^']*'>([\s\S]*?)<\/span>/g, "<em>$1</em>")
  s = s.replace(/<span class='ec-lm[^']*'>([\s\S]*?)<\/span>/g, "$1")
  s = removeTitleCenter(s)
  // tex4ht 把页眉横线渲染成一串下划线，按行删掉，再清空剩下的空段落
  s = s.replace(/<p[^>]*>[\s\r]*_{20,}[\s\r]*<\/p>/g, "")
  s = s.replace(/^\s*_{20,}\s*$/gm, "")
  s = s.replace(/<p[^>]*>\s*<\/p>/g, "")
  // LaTeX 的 \\section 在 tex4ht 里是 h3，页面上要当 h2 用（标题本身是 h1）
  s = s.replace(/<(\/?)h([3-5])\b/g, (m, slash, level) => "<" + slash + "@@H" + (Number(level) - 1) + "@@")
  s = s.replace(/@@H([0-9])@@/g, "h$1")
  s = renderMath(s)
  // KaTeX 出的 MathML 里带一层 <annotation>（原始 TeX），浏览器不显示但会被搜索索引当成正文，
  // 搜索结果里就会冒出 "\pi _\theta" 这种东西。去掉它。
  s = s.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "")
  s = s.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim()
  return s
}

function buildToc(html) {
  const headings = []
  const re = /<h([2-4])([^>]*)>([\s\S]*?)<\/h\1>/g
  let m
  while ((m = re.exec(html)) !== null) {
    const level = Number(m[1])
    const attrs = m[2]
    const text = m[3]
      .replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (!text) continue
    const idMatch = m[3].match(/id='([^']+)'/) || m[3].match(/id="([^"]+)"/) || attrs.match(/id=['"]([^'"]+)['"]/)
    headings.push({ level, text, id: idMatch ? idMatch[1] : "" })
  }
  stats.headings += headings.length
  if (headings.length < 2) return ""
  const parts = ['<ul class="note-toc-list">']
  let prev = 2
  for (const h of headings) {
    if (h.level > prev) parts.push("<ul>")
    else if (h.level < prev) parts.push("</li></ul></li>")
    const label = h.id
      ? '<a href="#' + h.id + '">' + h.text + "</a>"
      : "<span>" + h.text + "</span>"
    parts.push("<li>" + label)
    prev = h.level
  }
  parts.push("</li></ul>")
  return '<nav class="note-toc">' + parts.join("") + "</nav>"
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

function yaml(value) {
  return '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"'
}

function writeNote(slug, dir) {
  const rawPath = path.join(dir, "body.raw.html")
  const texPath = path.join(dir, "main.tex")
  if (!fs.existsSync(rawPath) || !fs.existsSync(texPath)) return
  const meta = parseMeta(fs.readFileSync(texPath, "utf8"))
  const html = transform(fs.readFileSync(rawPath, "utf8"))
  const toc = buildToc(html)

  // 正文放 assets/：Hugo 的 security.allowContent 不允许 content/ 里出现 .html
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
  lines.push("---")
  lines.push("")
  fs.writeFileSync(path.join(bundle, "index.md"), lines.join("\n"), "utf8")
  stats.notes += 1
}

function main() {
  if (!fs.existsSync(LATEX_OUT)) {
    console.error("[latex] 找不到 latex-out，请先运行 npm run notes:compile")
    process.exit(1)
  }
  cleanGenerated()
  for (const slug of listDirs(LATEX_OUT)) {
    writeNote(slug, path.join(LATEX_OUT, slug))
  }
  console.log("[latex] 页面 " + stats.notes + " 篇，公式 " + stats.math + " 个，失败 " + stats.mathFail + " 个，目录项 " + stats.headings + " 个")
  if (failures.length) {
    console.warn("[latex] 公式渲染失败样例：")
    for (const f of failures.slice(0, 12)) console.warn("  - " + f)
  }
}

main()