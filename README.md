# blog的碎碎念

<https://tanyrbs.github.io/> — THT 的个人博客。内容有两条来源：手写 Markdown 短文，和直接用
LaTeX 写的笔记（构建时编译成网页）。两者在页面上是**同一套模板**，都汇到
[/articles/](https://tanyrbs.github.io/articles/) 按系列分组。

## 页面结构

| 页面 | 内容 |
|---|---|
| 首页 `/` | 最新 8 篇文章卡片 + 右侧栏（最新发布 / 分类 / 标签） |
| 文章 `/articles/` | 按 `lectureSeries` 分系列框，笔记与短文混排 |
| 文章页 | 标题横幅 + 正文；侧栏是「目录 / 关于」两个标签页，目录带阅读进度条 |
| 文章索引 `/archives/` | 按年份归档 |
| 分类 `/categories/` | 系列一目了然的卡片列表 |
| 标签 `/tags/` | 标签云 |
| 搜索 `/search/?q=关键词` | Pagefind 全文搜索，侧栏搜索框提交到这里 |
| 关于 `/about/` | 个人页（导航里没有入口，可从侧栏关于卡片进） |

`/blog/` 和 `/notes/` 是两条内容来源各自的列表页，导航里不再露出，但链接可访问。

窄屏（≤960px，或浏览器放大到该宽度）自动切到单栏：顶部是「☰ + 站点名 + 搜索」的黑色工具栏，
左侧栏收进抽屉。

## 目录结构

```
archetypes/            hugo new 用的文章骨架（blog.md）
assets/css/            main.css（站点骨架）、lecture.css（文章模板）、latex-note.css（LaTeX 正文）
assets/js/site.js      侧栏抽屉、目录/关于标签切换、阅读进度
content/
  blog/                Markdown 短文（每条一个 .md）
  notes/               每条一个目录，index.md 由脚本生成，不要手改
  articles.md          合并列表页，layout 指到 layouts/_default/articles.html
latex/<slug>/          LaTeX 笔记源文件：main.tex + preamble.tex + figures/
layouts/
  _default/            single（正文）、list、articles、archives、terms、search、rss、404
  partials/            baseof 用到的：nav、profile、sidebar-tabs、article-toc、right-rail…
  shortcodes/          lecture-box（四种彩色盒子）
scripts/latex/         compile.mjs（TeX → HTML）、postprocess.mjs（清洗 + KaTeX + frontmatter）
scripts/hugo.mjs       跨平台调用 Hugo
docs/                  历史调研（Quartz 分析、LaTeX 发布方案），不参与构建
```

## 常用命令

```bash
npm ci                     # 首次：装 KaTeX 等构建依赖

node scripts/hugo.mjs new content/blog/my-post.md   # 按骨架新建 Markdown 文章
npm run note:new -- <slug> --title "标题"           # 新建 LaTeX 笔记骨架
node scripts/hugo.mjs server -D                     # 本地预览 http://localhost:1313

npm run notes              # 编译 latex/ 下的笔记 + 渲染公式，生成 content/notes 与 assets/notes
npm run site               # hugo --minify --gc
npm run search             # pagefind 建索引
npm run publish            # 上面三步一起
```

Windows 上 Hugo 不在 PATH 时 `scripts/hugo.mjs` 会自动去 `../tools/hugo/hugo.exe` 找；
也可以设环境变量 `HUGO`。

## 站点设置（hugo.toml）

| 键 | 作用 |
|---|---|
| `title` | 站点名，侧栏顶部、顶栏、浏览器标签页、RSS 都用它 |
| `params.author` | 作者名（关于卡片） |
| `params.tagline` | 侧栏与顶栏那一行标语 |
| `params.affiliation` / `affiliationSecondary` | 关于卡片里显示的两行学校/机构 |
| `params.email` / `github` / `wechat` | 关于卡片的三个图标链接 |
| `params.avatar` | 头像，放 `static/img/` |
| `params.seriesOrder` | `/articles/` 里系列框的显示顺序，未列出的按名字排在最后 |

## 内容模型

| | Markdown 短文 | LaTeX 笔记 |
|---|---|---|
| 源文件 | `content/blog/<slug>.md` | `latex/<slug>/main.tex` |
| 依赖 | 只要 Hugo | 还要 TeX Live（make4ht） |
| 公式 | `$...$` / `$$...$$`，构建期转 MathML | 原生 LaTeX，构建期转 MathML |
| 适合 | 随笔、教程、少量公式 | 公式密集、要出 PDF、已在 Overleaf 里写 |

页面零 JS 渲染公式：两种来源最后都是 KaTeX 的 MathML 输出，不加载 MathJax/KaTeX 运行时。

### 分组：系列、分类、标签

`/articles/` 按 `lectureSeries` 分框：

```yaml
lectureSeries: "强化学习"     # 系列名，就是分组键
lectureNumber: 2              # 框内排序
categories: ["强化学习"]       # 右侧栏「分类」
tags: ["PPO", "GAE"]          # 右侧栏「标签」
```

LaTeX 笔记写在 `main.tex` 开头的 `%!` 注释里：

```latex
%! title: 梯度、策略梯度与 PPO
%! date: 2026-10-25
%! slug: rl-ppo
%! series: 强化学习
%! number: 1
%! tags: 强化学习, PPO, 策略梯度
%! description: 一句话摘要，用于列表与搜索。
```

没有系列的文章会进「未分类」框，不会消失。**新增一个系列**只要给内容填上新的
`lectureSeries`，推上去自动生成系列框、`/categories/<系列>/` 分类页、`/tags/<标签>/`
标签页——不需要注册任何东西。

## 写一篇 Markdown 短文

```bash
node scripts/hugo.mjs new content/blog/rope.md
```

生成的骨架（`archetypes/blog.md`）：

```yaml
---
title: "rope"
date: 2026-11-22T21:40:00+08:00
lastmod: 2026-11-22T21:40:00+08:00
draft: true
slug: "rope"
articleStyle: "lecture"     # 套用这套模板
lectureSeries: ""
lectureNumber: 0
subtitle: ""
description: "一句话摘要"
summary: "更完整的摘要，用于 RSS 与首页卡片"
categories: []
tags: []
---
```

正文里可用的四种彩色盒子：

```markdown
{{</* lecture-box kind="summary" title="本文摘要" */>}}橙色：摘要{{</* /lecture-box */>}}
{{</* lecture-box kind="definition" title="定义 · RoPE" */>}}绿色：定义{{</* /lecture-box */>}}
{{</* lecture-box kind="analysis" title="分析" */>}}蓝色：推导{{</* /lecture-box */>}}
{{</* lecture-box kind="remark" title="备注" */>}}棕色：备注{{</* /lecture-box */>}}
```

写完后把 `draft` 改 `false`，`git push` 即可。

## 发布一篇新笔记

### 三步走（不需要本地装 TeX）

```bash
# 1) 生成骨架：latex/<slug>/{main.tex,preamble.tex,figures/}
npm run note:new -- rl-dpo --title "DPO 推导" --series "强化学习" --number 3 \
     --tags "强化学习,DPO" --description "一句话摘要"

# 2) 把 Overleaf 里的正文贴进 main.tex（保留文件顶部的 %! 元数据）

# 3) 推送，CI 用 texlive 容器编译并部署（约 2–4 分钟）
git add latex/rl-dpo && git commit -m "add note: rl-dpo" && git push
```

`npm run note:new` 只生成文件，不编译；生成的 `preamble.tex` 是通用数学模板
（ctexart + amsmath + thmtools + 定理/定义/注环境），需要别的宏包直接往里加。

想本地看效果（需要装 TeX Live + Node）：

```bash
npm ci
npm run publish      # 编译 + 构建 + 搜索索引
npm run serve        # http://localhost:1313 实时预览
```

### 在 Overleaf 里怎么写

- 模板就是 `scripts/latex/template/main.tex` + `preamble.tex`，Overleaf 里直接用这两份；
- 写完从 Overleaf 下载 `main.tex`（和改过的 `preamble.tex`），覆盖 `latex/<slug>/` 里的同名文件；
- 图片放 `latex/<slug>/figures/`，正文用 `\includegraphics{figures/x.png}`；
- **不要删 `main.tex` 顶部的 `%!` 注释**——标题、日期、系列、标签都从这几行读。

## 写一篇 LaTeX 笔记

1. 复制 `latex/rl-grpo/` 改名，改 `main.tex` 顶部的 `%!` 元数据与 `preamble.tex`；
2. 图片放同目录 `figures/`，用 `\includegraphics{figures/x.png}` 引用；
3. `npm run publish` 本地看效果，或直接推上去让 CI 编译。

构建管线：

```
latex/<slug>/main.tex
   │ make4ht -l -f html5 … "mathjax"      （中文必须 LuaLaTeX）
   ▼ latex-out/<slug>/body.raw.html
   │ scripts/latex/postprocess.mjs
   │   · 修 tex4ht + ctex 的畸形标签
   │   · KaTeX 把 \(…\) / \[…\] 渲染成 MathML
   │   · 生成目录、front matter、git 最后更新时间
   ▼ content/notes/<slug>/index.md + assets/notes/<slug>/body.html
   │ hugo
   ▼ public/ → pagefind → GitHub Pages
```

## 部署

`.github/workflows/pages.yml` 两个 job：

1. `notes`：在 `texlive/texlive` 容器里把每个 `.tex` 编译成 HTML 片段；
2. `build`：`npm ci` → KaTeX 渲染 → Hugo → Pagefind → 上传 artifact → 部署。

仓库 **Settings → Pages → Source** 选 **GitHub Actions**。推送 main 后大约 2–4 分钟上线。

## 已知坑

**tex4ht 的版本差异会改变公式包裹标签。** 本地 TeX Live 把行间公式包成
`<div class='mathjax-block'>`，CI 容器里的 make4ht 包成 `<span class='mathjax-block'>`，
环境型公式又是 `<span class='mathjax-env mathjax-align*'>`，属性引号还可能省略。
`postprocess.mjs` 这几种都匹配；**转换完还会自检**，产物里残留 `mathjax-*` 或原始
`\(` / `\[` 就让构建失败，不会把裸公式发布出去。

**中文必须走 LuaLaTeX。** `make4ht -x`（XeLaTeX）和 pdfLaTeX 会静默丢掉中文正文，
`compile.mjs` 会统计产物里的汉字数量，不过关就报错。

**生成物不要手改。** `latex-out/`、`assets/notes/`、`static/notes/`、`content/notes/*/`
都由脚本重建，已在 `.gitignore` 里。

## 依赖

- Hugo Extended 0.162+
- Node 20+（`scripts/*.mjs`，KaTeX 走 npm）
- TeX Live（含 `make4ht`/tex4ht），仅本地写 LaTeX 笔记时需要——只在 CI 上编译也可以

## 文档

`docs/` 是历史调研，不参与构建：

- [docs/latex-native-publishing.md](docs/latex-native-publishing.md)——为什么用 make4ht，lwarp / LaTeXML / Pandoc 的实测对比
- [docs/quartz-inspired-roadmap.md](docs/quartz-inspired-roadmap.md)——Quartz 的可迁移思路分析