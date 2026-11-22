---
title: "{{ replace .File.ContentBaseName "-" " " }}"
date: {{ .Date }}
lastmod: {{ .Date }}
draft: true
slug: "{{ .File.ContentBaseName }}"
articleStyle: "lecture"
lectureSeries: ""
lectureNumber: 0
subtitle: ""
description: "一句话摘要，会出现在列表和搜索结果里。"
summary: "更完整的摘要，用于 RSS 与首页卡片。"
categories: []
tags: []
isCJKLanguage: true
---

{{</* lecture-box kind="summary" title="本文摘要" */>}}
三两句说清这篇文章要解决什么问题、读完能得到什么。
{{</* /lecture-box */>}}

## 第一节

正文段落。行内公式这样写：$E = mc^2$。

行间公式单独成段：

$$
\boldsymbol{x}_t = E^\top \boldsymbol{o}_t \in \mathbb{R}^{d_e}.
$$

{{</* lecture-box kind="definition" title="定义 · 某某" */>}}
定义内容。
{{</* /lecture-box */>}}

### 小节

- 列表项支持 **加粗**、`行内代码`、[链接](https://example.com)。
- 表格、引用、图片都可以直接写 Markdown。

| 列一 | 列二 |
| --- | --- |
| 值 | 值 |
