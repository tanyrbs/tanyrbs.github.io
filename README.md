# tanyrbs.github.io

个人站点：Hugo 打站点外壳，笔记用 LaTeX 写、构建时编译成网页。

## 内容从哪来

| 目录 | 是什么 |
|---|---|
| `latex/<slug>/main.tex` | 笔记源文件（就是 Overleaf 里的那份），**唯一内容源** |
| `latex/<slug>/preamble.tex` | 该笔记的导言区（ctexart + amsmath + thmtools） |
| `latex/<slug>/figures/` | 笔记里的插图，编译后自动拷到 `static/notes/<slug>/figures/` |
| `content/blog/*.md` | 手写的短文（Markdown） |
| `content/notes/<slug>/index.md` | 由脚本生成，只有 frontmatter，不要手改 |
| `assets/notes/<slug>/body.html` | 由脚本生成，编译后的正文 |
| `layouts/`、`assets/css` | 站点外壳与样式 |

## 写一篇新笔记

1. 新建 `latex/<slug>/`，放 `main.tex` 和 `preamble.tex`（可以从别的笔记复制）。
2. 在 `main.tex` **最前面**加元数据注释（不影响 Overleaf 编译）：

```latex
%! title: 梯度、策略梯度与 PPO
%! date: 2026-10-25
%! slug: rl-ppo
%! series: 强化学习
%! number: 1
%! tags: 强化学习, PPO, 策略梯度
%! description: 一句话摘要，用于列表和搜索。
```

3. 本地跑 `npm run notes`，再 `npm run site`，或者一步到位 `npm run publish`。

已有的三篇：`rl-ppo`、`rl-rlhf-dpo`、`verl-note`。带插图的笔记把图片放在同目录的 `figures/` 下，
用 `\includegraphics{figures/xxx.png}` 引用即可，构建时会搬到 `static/notes/<slug>/`。

## 常用命令

```bash
npm ci             # 安装 KaTeX 等构建依赖
npm run notes      # 编译所有 .tex + KaTeX 渲染正文，生成 content/notes 与 assets/notes
npm run site       # hugo --minify --gc
npm run search     # pagefind 建搜索索引
npm run publish    # notes + site + search
```

本地预览：`npm ci && npm run notes && hugo server -D`

## 写一篇文章

站上有两种内容，**页面上长得一模一样**（同一套 lecture 模板），区别只在源文件写在哪：

| | Markdown 短文 | LaTeX 笔记 |
|---|---|---|
| 源文件 | `content/blog/<slug>.md` | `latex/<slug>/main.tex` |
| 依赖 | 只要 Hugo | 还要 TeX Live（make4ht） |
| 公式 | `$...# tanyrbs.github.io

个人站点：Hugo 打站点外壳，笔记用 LaTeX 写、构建时编译成网页。

## 内容从哪来

| 目录 | 是什么 |
|---|---|
| `latex/<slug>/main.tex` | 笔记源文件（就是 Overleaf 里的那份），**唯一内容源** |
| `latex/<slug>/preamble.tex` | 该笔记的导言区（ctexart + amsmath + thmtools） |
| `latex/<slug>/figures/` | 笔记里的插图，编译后自动拷到 `static/notes/<slug>/figures/` |
| `content/blog/*.md` | 手写的短文（Markdown） |
| `content/notes/<slug>/index.md` | 由脚本生成，只有 frontmatter，不要手改 |
| `assets/notes/<slug>/body.html` | 由脚本生成，编译后的正文 |
| `layouts/`、`assets/css` | 站点外壳与样式 |

## 写一篇新笔记

1. 新建 `latex/<slug>/`，放 `main.tex` 和 `preamble.tex`（可以从别的笔记复制）。
2. 在 `main.tex` **最前面**加元数据注释（不影响 Overleaf 编译）：

```latex
%! title: 梯度、策略梯度与 PPO
%! date: 2026-10-25
%! slug: rl-ppo
%! series: 强化学习
%! number: 1
%! tags: 强化学习, PPO, 策略梯度
%! description: 一句话摘要，用于列表和搜索。
```

3. 本地跑 `npm run notes`，再 `npm run site`，或者一步到位 `npm run publish`。

已有的三篇：`rl-ppo`、`rl-rlhf-dpo`、`verl-note`。带插图的笔记把图片放在同目录的 `figures/` 下，
用 `\includegraphics{figures/xxx.png}` 引用即可，构建时会搬到 `static/notes/<slug>/`。

## 常用命令

```bash
npm ci             # 安装 KaTeX 等构建依赖
npm run notes      # 编译所有 .tex + KaTeX 渲染正文，生成 content/notes 与 assets/notes
npm run site       # hugo --minify --gc
npm run search     # pagefind 建搜索索引
npm run publish    # notes + site + search
```

本地预览：`npm ci && npm run notes && hugo server -D`

 / `$...$`，构建期转 MathML | 原生 LaTeX，构建期转 MathML |
| 适合 | 随笔、教程、带少量公式 | 公式多、要出 PDF、已在 Overleaf 里写 |

### 写 Markdown 短文（推荐日常用）

```bash
node scripts/hugo.mjs new content/blog/my-post.md   # 按 archetypes/blog.md 生成骨架
node scripts/hugo.mjs server -D                     # 本地预览 http://localhost:1313
```

生成的 front matter 字段：

| 字段 | 作用 |
|---|---|
| `title` / `subtitle` / `description` / `summary` | 标题、副标题、列表摘要、RSS 摘要 |
| `date` / `lastmod` | 日期；`lastmod` 决定"更新于" |
| `articleStyle: "lecture"` | 用这套 lecture 模板（蓝标题 + 橙色标签栏） |
| `lectureSeries` / `lectureNumber` | 归入某个系列、第几讲；留空就不显示系列 |
| `categories` / `tags` | 分类与标签 |

正文里四个短代码盒子，`kind` 决定配色：

```markdown
{{</* lecture-box kind="summary" title="本文摘要" */>}}橙色：摘要 / 导读{{</* /lecture-box */>}}
{{</* lecture-box kind="definition" title="定义 · RoPE" */>}}绿色：定义{{</* /lecture-box */>}}
{{</* lecture-box kind="analysis" title="分析" */>}}蓝色：推导 / 分析{{</* /lecture-box */>}}
{{</* lecture-box kind="remark" title="备注" */>}}棕色：备注 / 坑{{</* /lecture-box */>}}
```

数学：行内 `$a^2+b^2=c^2# tanyrbs.github.io

个人站点：Hugo 打站点外壳，笔记用 LaTeX 写、构建时编译成网页。

## 内容从哪来

| 目录 | 是什么 |
|---|---|
| `latex/<slug>/main.tex` | 笔记源文件（就是 Overleaf 里的那份），**唯一内容源** |
| `latex/<slug>/preamble.tex` | 该笔记的导言区（ctexart + amsmath + thmtools） |
| `latex/<slug>/figures/` | 笔记里的插图，编译后自动拷到 `static/notes/<slug>/figures/` |
| `content/blog/*.md` | 手写的短文（Markdown） |
| `content/notes/<slug>/index.md` | 由脚本生成，只有 frontmatter，不要手改 |
| `assets/notes/<slug>/body.html` | 由脚本生成，编译后的正文 |
| `layouts/`、`assets/css` | 站点外壳与样式 |

## 写一篇新笔记

1. 新建 `latex/<slug>/`，放 `main.tex` 和 `preamble.tex`（可以从别的笔记复制）。
2. 在 `main.tex` **最前面**加元数据注释（不影响 Overleaf 编译）：

```latex
%! title: 梯度、策略梯度与 PPO
%! date: 2026-10-25
%! slug: rl-ppo
%! series: 强化学习
%! number: 1
%! tags: 强化学习, PPO, 策略梯度
%! description: 一句话摘要，用于列表和搜索。
```

3. 本地跑 `npm run notes`，再 `npm run site`，或者一步到位 `npm run publish`。

已有的三篇：`rl-ppo`、`rl-rlhf-dpo`、`verl-note`。带插图的笔记把图片放在同目录的 `figures/` 下，
用 `\includegraphics{figures/xxx.png}` 引用即可，构建时会搬到 `static/notes/<slug>/`。

## 常用命令

```bash
npm ci             # 安装 KaTeX 等构建依赖
npm run notes      # 编译所有 .tex + KaTeX 渲染正文，生成 content/notes 与 assets/notes
npm run site       # hugo --minify --gc
npm run search     # pagefind 建搜索索引
npm run publish    # notes + site + search
```

本地预览：`npm ci && npm run notes && hugo server -D`

，行间用单独成段的 `$` … `$`。构建时由 KaTeX 转成 MathML，
页面不加载任何 JS。图片直接写 Markdown 语法，文件放 `static/` 或与文章同名的 page bundle 里。

### 写 LaTeX 笔记

```bash
# 新建 latex/<slug>/main.tex + preamble.tex，开头加 %! 元数据（见上文）
npm run notes     # make4ht 编译 + KaTeX 渲染
npm run site      # 或者一步 npm run publish
```

### 发布

```bash
git add -A && git commit -m "..." && git push origin main
```

CI 会编译所有 `.tex`、构建站点、建搜索索引并部署，大约 2–4 分钟。

## 依赖

- **Hugo Extended 0.162+**
- **Node 20+**（跑 `scripts/latex/*.mjs`，KaTeX 通过 npm 安装）
- **TeX Live**（含 `make4ht` / tex4ht）。中文必须走 LuaLaTeX——`make4ht -l`，用 XeLaTeX 模式会**静默丢中文**。

Windows 上 Hugo 不在 PATH 时可以这样：

```powershell
D:\00_project\005blog\tools\hugo\hugo.exe server -D
```

## 构建管线

```
latex/<slug>/main.tex
      │  make4ht -l -f html5 ... "mathjax"      （TeX 引擎，中文走 LuaLaTeX）
      ▼
latex-out/<slug>/body.raw.html
      │  scripts/latex/postprocess.mjs
      │    · 修 tex4ht + ctex 的畸形标题标签
      │    · 用 KaTeX 把 \(...\) / \[...\] 渲染成 MathML（构建期，页面零 JS）
      │    · 生成目录、frontmatter、git 最后更新时间
      ▼
content/notes/<slug>/index.md + assets/notes/<slug>/body.html
      │  hugo
      ▼
public/  →  pagefind  →  GitHub Pages
```

选型调研、make4ht 的两个坑，以及 PDF / lwarp / LaTeXML 等路线的实测对比见
[`docs/latex-native-publishing.md`](docs/latex-native-publishing.md)。

## 已知坑

**tex4ht 的版本差异会改变公式包裹标签。** 同一份 `.tex`，本地 TeX Live 2025 把行间公式包成
`<div class='mathjax-block'>`，CI 容器里的 make4ht 却包成 `<span class='mathjax-block'>`；
环境型公式（align / equation）又是 `<span class='mathjax-env mathjax-align*'>`，属性引号还可能被省略。
`postprocess.mjs` 这三种都匹配，写新的清洗规则时别只认一种写法。

**转换完会自检。** 产物里如果还残留 `mathjax-*` 包裹或原始 `\(` / `\[`，`npm run notes` 直接以退出码 1
中止构建，不会再把裸公式发布出去。（线上公式"乱码"就是漏了这一层：脚本只认 `<div>`，CI 给的是 `<span>`，
于是整页公式原样输出成 TeX 源码。）

**中文必须走 LuaLaTeX。** `make4ht -x`（XeLaTeX）和 pdfLaTeX 都会静默丢掉中文正文，
`compile.mjs` 会统计产物里的汉字数量，不过关就报错。

## GitHub Pages

`.github/workflows/pages.yml` 分两个 job：

1. `notes`：跑在 `texlive/texlive:latest` 容器里，把每篇 `.tex` 编译成 HTML 片段。
2. `build`：装依赖 → KaTeX 渲染 → Hugo → Pagefind → 上传 artifact → 部署。

仓库设置里 **Pages > Build and deployment > Source** 选 **GitHub Actions**。

## 评论

Giscus 已接好但默认关闭。开启方法：仓库启用 Discussions、安装 giscus app，再把 `hugo.toml` 里 `params.giscus.repoId` / `categoryId` 填上并设 `enabled = true`。