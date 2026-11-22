# Quartz 能给你这个博客什么启发

- 分析对象：[jackyzha0/quartz](https://github.com/jackyzha0/quartz)，本机 clone 源码阅读（不是二手资料）
- 对照对象：本站 —— Hugo 0.162 + 自建主题，双语 en / zh-cn，Pagefind，GitHub Pages
- **版本说明**：仓库当前默认分支是 `v5`（2026-11），`v4` 是上一代。两个分支我都读了：v5 把配置从 TypeScript 换成 YAML（`quartz.config.ts` → `quartz.config.yaml`）、把插件拆成 `@quartz-community/*` 独立 npm 包并加了 lockfile、把 frontmatter / 链接解析 / 草稿 / 内容索引改成"内建处理"。**架构主线没变**：`contentIndex.json` 仍是搜索、图谱、Explorer 的数据源（v5 的 `docs/plugins/ContentIndex.md` 原文：*"It also emits a `contentIndex.json` file which is used by dynamic frontend components like search and graph"*）。下文提到的源码路径若标注 v4，在 v5 里通常已被搬到 `quartz/plugins/builtins/` 或拆成插件仓库。

---

## 一句话结论

Quartz 真正可迁移的东西不是它的 UI，而是**把"A 笔记引用 B 笔记"这件事变成构建期可查询的数据**。它站内所有看起来"很酷"的功能——反向链接、关系图、悬停预览、搜索、Explorer——都是这一份链接数据的下游消费者。

你的站点现在缺的正是这份数据：笔记之间的引用只存在于正文文字里，构建完成就丢了。

---

## 1. 两个项目解决的不是同一个问题

| | 本站（时间线博客） | Quartz（数字花园） |
|---|---|---|
| 组织单位 | Post，有日期，有先后 | Note，无日期，靠链接成网 |
| 入口 | 首页 / 标签 / 归档 → 文章 | 任意链接 → 任意笔记 |
| 读者路径 | 线性、有始有终 | 游走、可随时离开 |
| 链接的作用 | 参考文献 | 结构本身（导航 + 语义 + 相关推荐） |
| 时间的作用 | 排序主键 | 只是"最后更新"的提示 |
| 内容寿命 | 发布即定稿 | 持续更新 |
| 站点像 | 刊物 | 思想的外置硬盘 |

Quartz 的 `docs/philosophy.md` 直接引用 *The Garden and the Stream*，明确反对 file cabinet 式的组织。所以值得抄的是"笔记形态里那些让它可用的机制"，不是博客的外观。

**一个具体判断**：你已经在写 lecture 系列（`lectureSeries: "LLM基础架构"`，第 1 讲，`lectureNumber: 1`）。系列笔记天然是有链接结构的——讲 RoPE 时要回到 Embedding 那篇的定义，后面讲注意力又会引用 RoPE 的结论。这些关系现在只能手写成「参见第 1 讲」，既不能反查，也不能自动生成目录、图谱或相关推荐。

---

## 2. Quartz 架构里真正值钱的三个机制

### A. 构建期一张 `contentIndex.json`，客户端只读一次

`quartz/plugins/emitters/contentIndex.tsx`（v5：`quartz/plugins/builtins/contentIndex.ts`）在构建末尾产出一份 JSON：slug → `{title, links[], tags[], content}`。然后 `quartz/components/renderPage.tsx` 把它内联成一段全局脚本：

```ts
const fetchData = fetch("/static/contentIndex.json").then(data => data.json())
```

搜索（FlexSearch）、关系图（d3-force 算坐标 + pixi 渲染）、Explorer 全部 `await fetchData`。一次构建、一次请求、四个功能。

**抄思想，别抄实现**：这个 JSON 是**单文件、含全站正文、不分片**的。几百篇还行，几千篇就是首屏几 MB——对比 Pagefind 是按语言、按页分片、只取命中的那几个文件（你现在的 `public/pagefind/` 一共 675 KB）。真要自建索引，正文和元数据分开、按需取。

### B. 链接是构建期数据，不是渲染期文本

- 链接解析（v4 是 `CrawlLinks` 插件，v5 内建为 `configuration.links`）遍历 HAST，把每个 `<a>` 标成 `internal` / `external`，顺手把目标收进 Set → `file.data.links`
- 反向链接不靠客户端爬，构建期就算好（v4 `quartz/components/Backlinks.tsx:27`，v5 是 `@quartz-community/backlinks` 插件，机制相同）：

```ts
const backlinkFiles = allFiles.filter((file) => file.links?.includes(slug))
```

- 关系图、悬停预览、搜索结果预览都消费同一份 `links` / `content`

这条设计的意义：**新增一个"谁引用了它"的功能是免费的**，因为关系已经在数据里躺着。

### C. 兼容层：写着写着就发布了

`ObsidianFlavoredMarkdown` + `Frontmatter` + `CrawlLinks` 三个插件让 Obsidian 的 `[[ ]]`、`![[ ]]`、`> [!note]`、frontmatter、别名全部直通，没有转换步骤。你的 README 写着"在 Obsidian 里写，再复制进 `content/`"——那这一层就是你流程里最该补齐的地方。

补充一个 Quartz 自己文档里的安全提醒：**filter 只过滤 Markdown，附件（图片、PDF、录音）永远会被原样发布**。你有 Obsidian 私库，一旦开始整目录同步，附件泄露是最容易踩的坑。

---

## 3. 可以搬进 Hugo 的清单

| # | 能力 | Quartz 的做法 | Hugo 侧等价物 | 成本 | 对你 |
|---|---|---|---|---|---|
| 1 | 全文 RSS | `ContentIndex({rssFullHtml})` | 覆写 `layouts/_default/rss.xml` | 1 小时 | 高 |
| 2 | git 驱动的"最后更新" | `CreatedModifiedDate({priority:["frontmatter","git","filesystem"]})` | `enableGitInfo` + `[frontmatter] lastmod` | 30 分钟 | 高 |
| 3 | Obsidian callout | OFM 插件 | `render-blockquote.html` + 内置 `.AlertType` | 1 小时 | 高 |
| 4 | `[[wiki 链接]]` | OFM + `CrawlLinks(shortest)` | 内容后处理 partial（§4.2） | 半天 | 高 |
| 5 | 反向链接面板 | `Backlinks.tsx` 构建期反查 | `partialCached` 反查表 + 右栏 partial | 半天 | 高 |
| 6 | 内容索引 JSON | `contentIndex.tsx` | 自定义 output format `index.json` | 1 小时 | 中（其它功能的地基） |
| 7 | 悬停预览 | fetch 目标页 + `.popover-hint` | Pagefind fragment 或 index.json | 1 天 | 中 |
| 8 | Ctrl+K 搜索 | 自带 | Pagefind 胶水代码 | 半天 | 中 |
| 9 | 目录页 / 文件夹说明 | `FolderPage` + `index.md` | `_index.md` + 自定义 list 布局 | 半天 | 中 |
| 10 | 关系图 | d3 计算 + pixi 渲染 | d3 + 预计算坐标（别用 pixi） | 2 天 | 低（< 30 篇时纯装饰） |
| 11 | 旧 URL 跳转 | `AliasRedirects`（meta refresh + noindex） | frontmatter `aliases`（Hugo 内置） | 0 | 高（改 URL 前必读） |

---

## 3.5 顺手查到的两个现网问题

调研 Quartz 的搜索实现时顺手核了你现在的 Pagefind 产物，有两处值得确认（数据来自仓库里的 `public/pagefind/pagefind-entry.json`）：

```json
{"version":"1.5.2","languages":{
  "zh-cn":{"hash":"zh-cn_86ea12f30bd53","wasm":null,"page_count":3},
  "en":{"hash":"en_e9a39ba370","wasm":"en","page_count":2}
}}
```

**① 只有 5 个页面进了索引（en 2 + zh-cn 3）。** Pagefind 的规则是：一旦站内出现 `data-pagefind-body`，**没有这个属性的页面就完全不索引**。你只把它加在 `single.html` 的 `.article-content` 上，所以首页、`/blog/`、`/archives/`、分类页、标签页都不在索引里。

这本身可能正是你要的（搜索只命中正文，不冒出"标签：RoPE"这种结果）。但如果确认了，建议顺手改一处：把 `data-pagefind-body` 挪到 `<article>` 上，给 TOC 和评论区加 `data-pagefind-ignore`。这样 `<h1>` 会进正文，Pagefind 用 h1 当结果标题，比现在回退到 `<title>`（"Embedding 与位置编码 | 谭浩陶"）干净。

**② 中文没有专用分词器。** `zh-cn` 的 `wasm` 是 `null`，`en` 的是 `"en"`；产物里 `wasm.en.pagefind` 与 `wasm.unknown.pagefind` 并存，说明中文走的是通用分词。这是 Pagefind 的已知短板（CJK 按词切、不做子串模糊匹配，见 `Pagefind/pagefind#987`）。表现是"知识图谱"可能搜不到"图谱"。

对照 Quartz：它自己写了一个 CJK 分类器（`search.inline.ts` 里的 `encoder`，把汉字按码点范围单个切分），所以中文召回是准的，代价是索引换到浏览器里跑、全量下载。你现在没必要为此换方案，但**如果中文搜索准确性是硬指标**，可以在 Pagefind 之外加一条只针对中文的字符级索引（Fuse.js/FlexSearch + 二字切分），首屏换准确率。

顺带两个 Pagefind 配置项，你还没设：`exclude_selectors` 排除 `.site-sidebar` / `.site-rail`（虽然它们现在不在 body 内，加着更稳），以及 CI 里 `npx -y pagefind` 建议锁版本（`npx -y pagefind@1.5.2`），否则哪天上游发版会莫名改变索引行为。

---

## 4. 已在本机 Hugo 0.162 验证过的最小实现

下面每一段都在这台机器上用 `hugo v0.162.0` 真跑过，不是伪代码。放进你的仓库时文件名照抄即可。

### 4.1 内容索引：`public/index.json`

```toml
# hugo.toml
[outputFormats.Index]
mediaType = "application/json"
baseName = "index"
isPlainText = true
notAlternative = true

[outputs]
home = ["HTML", "RSS", "Index"]   # 注意保留你原来的 RSS
```

```go-html-template
{{/* layouts/index.json.json */}}
{{- $idx := dict -}}
{{- range site.RegularPages -}}
  {{- $idx = merge $idx (dict .RelPermalink (dict
      "title" .Title
      "tags" (.Params.tags | default slice)
      "summary" (.Summary | plainify)
      "date" (.Date.Format "2006-01-02")
  )) -}}
{{- end -}}
{{ $idx | jsonify }}
```

产出（实测）：`{"/zh-cn/blog/.../":{"title":...,"tags":[...],"summary":...}}`

### 4.2 `[[wiki 链接]]`

**为什么必须后处理**：goldmark 不会把 `[[x]]` 解析成节点（实测 `[[位置编码]]` 原样输出为纯文本），所以 `render-link.html` 这类 hook 抓不到它，只能在渲染后的 HTML 上做替换。

```go-html-template
{{/* layouts/partials/page-index.html：建一次"名字 → 链接"表 */}}
{{- $m := dict -}}
{{- range site.RegularPages -}}
  {{- $keys := slice (lower .Title) -}}
  {{- with .File }}{{ $keys = $keys | append (lower (path.Base .TranslationBaseName)) }}{{ end -}}
  {{- range .Aliases }}{{ $keys = $keys | append (lower (strings.TrimPrefix "/" (strings.TrimSuffix "/" .))) }}{{ end -}}
  {{- range $keys }}{{ $m = merge $m (dict . $.RelPermalink) }}{{ end -}}
{{- end -}}
{{- return $m -}}
```

```go-html-template
{{/* layouts/partials/render-content.html：替换 [[目标|别名]] */}}
{{- $c := string .Content -}}
{{- $index := partialCached "page-index.html" . "page-index" -}}
{{- $blocks := slice -}}
{{/* 先把 <pre>/<code> 挖出来，否则代码示例里的 [[...]] 会被误替换 */}}
{{- range findRESubmatch `(?s)<pre[\s\S]*?</pre>|<code[\s\S]*?</code>` $c -}}
  {{- $blocks = $blocks | append (index . 0) -}}
  {{- $c = replace $c (index . 0) (printf "@@CB%d@@" (sub (len $blocks) 1)) -}}
{{- end -}}
{{- range findRESubmatch `\[\[([^\]]+)\]\]` $c -}}
  {{- $raw := index . 0 -}}
  {{- $parts := split (index . 1) "|" -}}
  {{- $key := lower (strings.TrimSpace (index $parts 0)) -}}
  {{- $label := cond (gt (len $parts) 1) (index $parts 1) (index $parts 0) -}}
  {{- with index $index $key -}}
    {{- $c = replace $c $raw (printf `<a class="wikilink" href="%s">%s</a>` . $label) -}}
  {{- else -}}
    {{- warnf "wikilink %q not found (from %s)" $key $.RelPermalink -}}
  {{- end -}}
{{- end -}}
{{- range $i, $b := $blocks -}}
  {{- $c = replace $c (printf "@@CB%d@@" $i) $b -}}
{{- end -}}
{{ $c | safeHTML }}
```

用法：把 `layouts/_default/single.html` 里的 `{{ .Content }}` 换成 `{{ partial "render-content.html" . }}`。

两个容易漏的点：

- `aliases` **不是 Page**，`.Site.GetPage` 永远查不到它。旧链接想被 `[[ ]]` 命中，必须在建索引时手动把 `.Aliases` 加进去（上面的 `page-index.html` 已经这么做了，这也是 Quartz 的 `frontmatter.ts` 里 `allSlugs.push(...file.data.aliases)` 那一行的等价物）。
- 中文标题如果把文件名也写成中文，URL 会被百分号编码成 `/blog/2026/09/%E7%9F%A5%E8%AF%86...`。索引里同时存"小写标题 / 文件名 / ASCII slug / aliases"四个键，写作时就能一直用中文名引用。

实测结果：

- `[[位置编码]]` → `<a class="wikilink" href="/zh-cn/blog/.../">位置编码</a>`（中文标题、跨目录都能命中）
- `[[位置编码|RoPE 那篇]]` → 标签被替换
- 行内代码 ``[[x]]`` 和代码块里的 `[[x]]` 保持原样
- 找不到目标时 `warnf` 报错并指出来源页 —— 相当于 Quartz v5 的 `quartz/util/linkReport.ts`（v4 只把"死链检测"写在 TODO 里，v5 补上了：构建后统一报告 `{from, to, reason}`，甚至能说明"目标被 Drafts 过滤器删了"）

顺带一提，反向的普通 Markdown 链接 `[文字](位置编码)` 用 `render-link.html` + `.Page.GetPage` 只能解析同目录，跨目录要回退到同一张 `page-index` 表。**两套语法必须过同一张表**，否则迟早不一致。

### 4.3 反向链接：`O(n)` 反查表

```go-html-template
{{/* layouts/partials/backlink-index.html：permalink → 引用它的页面 */}}
{{- $rev := dict -}}
{{- $idx := partialCached "page-index.html" . "page-index" -}}
{{- range $src := site.RegularPages -}}
  {{- $targets := slice -}}
  {{- range findRESubmatch `\[\[([^\]|]+)(?:\|[^\]]*)?\]\]` $src.RawContent -}}
    {{- with index $idx (lower (strings.TrimSpace (index . 1))) -}}
      {{- $targets = $targets | append . -}}
    {{- end -}}
  {{- end -}}
  {{- range uniq $targets -}}
    {{- $rev = merge $rev (dict . (index $rev . | default (slice) | append $src)) -}}
  {{- end -}}
{{- end -}}
{{- return $rev -}}
```

```go-html-template
{{/* layouts/partials/backlinks.html */}}
{{- $rev := partialCached "backlink-index.html" . "backlink-index" -}}
{{- with index $rev .RelPermalink -}}
  <section class="rail-panel">
    <h2>{{ i18n "backlinks" }}</h2>
    <ul class="rail-list">
      {{- range . }}<li><a href="{{ .RelPermalink }}">{{ .Title }}</a></li>{{ end -}}
    </ul>
  </section>
{{- end -}}
```

`partialCached` 保证整站只扫一遍（不是每页扫一遍）。我在测试站点里验证过：三条引用去重成三条，不重复。

### 4.4 Obsidian callout：Hugo 其实已经解析好了

这是本次调研最省事的一个发现：Hugo 0.162 会把 `> [!任意类型]` 识别成 alert，render hook 里直接拿得到 `.Type == "alert"`、`.AlertType`、`.AlertTitle`、`.AlertSign`（`+` / `-` 控制折叠）。我实测 `[!note]`、`[!INFO]`、`[!definition]`、`[!todo]`、`[!success]`、`[!bug]` 全部识别，大小写不敏感——**自定义类型也能过**，正好对上你 `lecture-box` 的 `summary / definition / analysis / remark`。

不写 hook 的话，输出是普通 `<blockquote>` 加原样的 `[!note]` 文字。补一个 hook 即可：

```go-html-template
{{/* layouts/_default/_markup/render-blockquote.html */}}
{{- if eq .Type "alert" -}}
  <aside class="callout callout--{{ .AlertType }}">
    {{- with .AlertTitle }}<p class="callout-title">{{ . }}</p>{{ end -}}
    <div class="callout-body">{{ .Text }}</div>
  </aside>
{{- else -}}
  <blockquote>{{ .Text }}</blockquote>
{{- end -}}
```

然后 CSS 一套变量色就行，`lecture-box` 继续保留给需要自定义标题/系列的场景，两者不冲突。

### 4.5 全文 RSS

Hugo 内置模板只用 `.Summary`（你的 `summaryLength = 28`，基本等于没摘要）。覆写 `layouts/rss.xml`，把 `<description>` 换成全文。两个细节：站内相对链接必须绝对化（RSS 阅读器里 `/zh-cn/...` 会指向阅读器自己的域名），HTML 必须转义（Hugo 内部模板同样用 `transform.XMLEscape`）。

```go-html-template
{{ range first 20 site.RegularPages.ByDate.Reverse }}
<item>
  <title>{{ .Title }}</title>
  <link>{{ .Permalink }}</link>
  <pubDate>{{ .Date.Format "Mon, 02 Jan 2006 15:04:05 -0700" }}</pubDate>
  <description>{{ .Content
    | replaceRE `href="/` (printf `href="%s` site.BaseURL)
    | replaceRE `src="/`  (printf `src="%s`  site.BaseURL)
    | transform.XMLEscape | safeHTML }}</description>
</item>
{{ end }}
```

实测输出（含站内链接与图片的那段正文）：

```xml
<description>&lt;p&gt;正文里有一个站内链接 &lt;a href=&#34;https://example.org/notes/position-encoding/&#34;&gt;位置编码&lt;/a&gt;
和一张图 &lt;img src=&#34;https://example.org/img/a.png&#34; alt=&#34;图&#34;&gt;。&lt;/p&gt;…</description>
```

对技术博客，RSS 全文是"被认真订阅"的门槛；只给摘要的源基本会被丢进 TODO 然后忘掉。

### 4.6 git 驱动的"最后更新"

```toml
# hugo.toml
enableGitInfo = true

[frontmatter]
  lastmod = ["lastmod", ":git", ":fileModTime"]
```

你的 `post-meta.html` 已经在显示 `.Lastmod > .Date` 时的 "更新于"，只是现在要手填。接上 git 之后它会自动反映真实修改时间——这正是 Quartz 的 `defaultDateType: "modified"` 在做的事。注意：CI 里 checkout 必须是完整历史（你的 `fetch-depth: 0` 已经满足）。

### 4.7 URL 结构（趁只有 2 篇）

现在：/blog/2026/09/embedding-position-encoding/

问题：日期路径把"这是旧闻"写死进 URL。笔记是会持续改的，改完 URL 一动不动会显得很怪；而如果哪天真想改结构，没有旧链接兜底就是纯粹的 404。

两条建议：

1. 把日期从 permalink 里去掉：/blog/embedding-position-encoding/（改 `[permalinks.page]` 一行）
2. 更彻底一点，内容模型从 "post" 换成 "note"：/notes/xxx/，并在 frontmatter 里给每篇加 `aliases: ["/blog/2026/09/embedding-position-encoding/"]`，Hugo 会自动生成带 `noindex` 的 meta refresh 跳转页（等价于 Quartz 的 `AliasRedirects`）。

**现在改是改一行配置，20 篇之后是迁移工程。**

---

## 5. 不建议抄的部分

| 不抄 | 理由 |
|---|---|
| 整套迁移到 Quartz | ① 双语内容它做不到：`locale` 只翻译界面字符串，一个站点一个语言，没有 en/zh 对应关系、没有 hreflang、没有 `/zh-cn/` 子目录。你现在这套 `translationKey` + 双 contentDir 是它的空白区。② lecture 样式、`lecture-box`、构建期 MathML 都是 Hugo 侧现成资产，迁过去等于重写。③ 引入 Node 22 + pixi/d3/satori/shiki/sharp，构建设施从"一个二进制"变成"一条 npm 流水线"。④ 产物也变重：v5 一个页面引 29 个样式表 + 4 个组件脚本；你现在是 1 个 fingerprinted CSS + 1 个 JS。 |
| SPA / micromorph 局部刷新 | 它解决的是"静态站翻页闪白"。有意思的是 **Quartz 5.1 自己给出了答案**：新增的 `configuration.prefetch`（默认 `viewport`）在你关掉 SPA 时会退化成"让浏览器预取"——支持 Speculation Rules 就用 Speculation Rules，否则 `<link rel="prefetch">`（原文见 `docs/features/prefetching.md`）。也就是说预取是主菜，SPA 只是没预取到时的兜底。它的策略参数也值得抄：hover 65ms 触发、并发 2、每页最多 30 条、内存缓存 40 页 5 分钟。你在 `head.html` 加一段 `<script type="speculationrules">` 就能拿到"点击即到"的体感，零运行时、不碰 Pagefind、不碰暗色模式。 |
| pixi.js 关系图 | 为几十个节点引入 WebGL 渲染器不划算。真要图，d3-force 在构建期算好坐标，客户端画 SVG 就够，体积差一个数量级。 |
| satori 逐页 OG 图 | Node 里渲染 HTML 到图片。Hugo 侧要么用 `images.Text` 拼（效果一般），要么 CI 起浏览器（重）。前期一张默认图 + 每篇 `images:` frontmatter 完全够。 |
| Explorer 全站文件树 | 你的内容是有分类的博客，不是一个大 vault。文件树在手机上占满屏还帮不上忙，分类 + 标签已经覆盖了这个需求。 |
| 照抄"万物皆插件" | v5 的插件生态（`@quartz-community/*`、独立版本号、lockfile、`npx quartz plugin doctor`）很漂亮，但 Quartz 团队在同一版里**又**把 frontmatter、链接解析、草稿、内容索引改回"内建处理"，理由写得很直白：它们"作为插件被关掉时会把站点搞坏"。边界该这么划：**站点正确性相关的内建，可选能力才插件化**。 |

---

## 6. 落地顺序

**Sprint 1（半天，纯配置 + 一个 partial）**
1. 全文 RSS
2. `enableGitInfo` + git lastmod
3. 右栏：把"最新文章"换成当前页的"前后讲 / 同系列"（`lectureSeries` + `lectureNumber` 排序即可）
4. URL 去日期 + `aliases`

**Sprint 2（1–2 天，写作体验）**
5. `render-blockquote.html`：Obsidian callout 直通
6. `page-index` + `render-content`：`[[ ]]` 直通
7. `backlink-index` + 右栏"链接到这里"
8. `render-image.html`：`![[图片]]` 映射到 page resource

**Sprint 3（按需）**
9. `index.json` + 悬停预览
10. Pagefind 的 Ctrl+K / `#tag` 前缀搜索
11. 系列地图页（相当于 Quartz 的 folder note）
12. 笔记 > 30 篇、连接 > 100 条之后，再考虑关系图

---

## 7. 附：读 Quartz 源码的入口

| 想学什么 | 看哪里 |
|---|---|
| 整体流水线 | `docs/advanced/architecture.md` |
| 为什么这么设计 | `docs/philosophy.md`、`docs/advanced/paths.md`（slug 的四种类型和一个教训：路径要当成类型对待） |
| 内容索引 | `quartz/plugins/emitters/contentIndex.tsx`（v4）/ `quartz/plugins/builtins/contentIndex.ts`（v5） |
| 链接解析 | `quartz/plugins/transformers/links.ts`（v4）/ `quartz/plugins/builtins/links.ts`（v5）、`quartz/util/path.ts` |
| 死链报告 | `quartz/util/linkReport.ts`（v5，构建后统一报 `{from, to, reason}`） |
| Obsidian 语法 | `quartz/plugins/transformers/ofm.ts`（wikilink / embed / callout 全在这里） |
| 反链 | `quartz/components/Backlinks.tsx`（v4）/ `@quartz-community/backlinks`（v5） |
| 悬停预览 | `quartz/components/scripts/popover.inline.ts`（fetch 目标页 + `.popover-hint` 抠片段） |
| 搜索 | `quartz/components/scripts/search.inline.ts`（FlexSearch + 自己写的 CJK 分词器，中文按单字切） |
| 反链的另一种官方写法 | `jmooring/hugo-module-backlinks`（Hugo 维护者的模块：用 `render-link.backlinks.json` 只在某个 output format 下收集边，再用 `site.Home.Store` 汇总——比扫 `.RawContent` 更"正式"，但依赖 Hugo ≥0.148 且收集时机需要自己验证） |
| 索引如何内联给客户端 | `quartz/components/renderPage.tsx`:30 |
| 预取（不写 SPA 也能秒开） | `docs/features/prefetching.md`、`quartz/components/scripts/prefetch.inline.ts` |
| 配置面 | v4：`quartz.config.ts` + `quartz.layout.ts`；v5：`quartz.config.yaml` + `quartz.ts` + `docs/layout-components.md` |

---

*本文 `§4` 的每段模板/配置都在本机 Hugo v0.162.0 上跑过：自定义 output format、`[[ ]]` 后处理（含代码块保护）、反链反查、blockquote alert hook、全文 RSS、git 驱动的 `.Lastmod`。§3.5 的 Pagefind 数字取自仓库里 `public/pagefind/pagefind-entry.json` 的实际产物。*
