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