# tanyrbs.github.io

Personal site and blog powered by Hugo, GitHub Actions, and GitHub Pages.

## Write a post

English posts go in `content/en/blog/`; Chinese posts go in `content/zh-cn/blog/`.

Create a Markdown file like this:

```markdown
---
title: "Post Title"
date: 2026-05-27T10:00:00+08:00
draft: false
tags: ["notes"]
categories: ["research"]
description: "Short SEO description."
summary: "Short summary shown on the blog index."
---

Post content goes here.
```

To link translations, give matching posts the same `translationKey`.

## Local preview

Install Hugo Extended, then run:

```powershell
hugo server -D
```

This workspace also has a downloaded Hugo binary at:

```powershell
D:\00_project\005blog\tools\hugo\hugo.exe server -D
```

Build and generate the search index:

```powershell
D:\00_project\005blog\tools\hugo\hugo.exe --minify --gc
npx -y pagefind --site public
```

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds the site and deploys `public/` to GitHub Pages.

In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.

## Comments

Giscus is wired into the templates but disabled by default. To enable it:

1. Enable GitHub Discussions for the repository.
2. Install the giscus app for the repository.
3. Fill `params.giscus.repoId` and `params.giscus.categoryId` in `hugo.toml`.
4. Set `params.giscus.enabled = true`.
