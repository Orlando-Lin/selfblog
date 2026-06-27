# VIRONGX 博客 · 项目交接手册

> 每次较大改动后更新本文件，方便新对话快速恢复上下文。

最后更新：**2026-06-26**

---

## 1. 项目是什么

- **路径**：`F:\blog\selfblog-next`
- **技术栈**：Next.js 16（App Router）+ TypeScript + Tailwind v4
- **部署**：静态导出 `output: "export"` → `out/` → GitHub Pages
- **域名**：`www.virongx.com`（`public/CNAME`）
- **作者**：曹淋锦荣 · `Cao_mouiller@163.com` · GitHub `Orlando-Lin`

---

## 2. 主页双模式

| 开关 | 位置 | 说明 |
|------|------|------|
| 普通 / 极客 | 导航栏 | 仅 **首页布局**不同，存 `localStorage.home-mode` |
| 亮 / 暗 | 导航栏 | `next-themes`，存 `localStorage.theme` |
| 中 / EN | 导航栏 | `localStorage.lang`，文案在 `src/lib/i18n.ts` |

- **普通模式**（默认）：`src/components/home/NormalHome.tsx` — 杂志风 Hero + 作品 + 联系
- **极客模式**：`src/components/home/GeekHome.tsx` — 终端窗口 Hero + 作品 + 联系
- 作品 / 联系锚点：`#works`、`#contact`（两种模式都有）

---

## 3. 导航结构

| 项 | 行为 |
|----|------|
| 首页 | `/` |
| 博客 | 悬浮下拉 → 文章 / 分类 / 标签 / 搜索 |
| 工具箱 | `/toolbox`（占位，待做） |
| 非遗 | `/heritage`（占位，待做） |
| 作品 | `/#works` 锚点 |
| 联系我 | `/#contact` 锚点 |

配置：`src/lib/site.ts`

---

## 4. 博客与文章

### 4.1 写文章（Markdown）

- **目录**：`content/posts/*.md`
- **模板**：`content/posts/_template.md`（复制后去掉 `_` 前缀）
- **Frontmatter 字段**：

```yaml
---
title: 标题
description: 摘要
date: 2026-06-26
category: 技术        # 分类（中文随意，如：技术、随笔、AI教程）
tags: [Next.js, AI]   # 标签数组
cover: /images/xx.jpg # 可选
---
```

- **格式**：标准 Markdown + GFM（表格、任务列表等）
- **不要用** Word / 纯 HTML 页面；MD 是唯一内容源

### 4.2 博客检索

| 入口 | URL | 说明 |
|------|-----|------|
| 文章 | `/blog` | 按时间倒序，**每页 10 篇**（`POSTS_PAGE_SIZE`） |
| 分类 | `/blog?view=categories` | 分类列表 → `/blog/category/[slug]/` |
| 标签 | `/blog?view=tags` | 标签云 → `/blog/tag/[slug]/` |
| 搜索 | `/blog?view=search` | 按 **标题** 模糊匹配 |

逻辑：`src/lib/posts.ts`、`src/components/blog/BlogHub.tsx`

### 4.3 文章页

- 路由：`/blog/[slug]/`
- **左侧目录**：自动从 `##` `###` 标题提取（`extractHeadings`）
- 渲染：`src/components/Markdown.tsx`（rehype-slug 生成锚点 id）

---

## 5. 普通主页 Hero 视频

- 视频路径（任选其一放入 `public/hero/`）：
  - `hero.mp4`
  - `hero.webm`
  - 封面图 `poster.jpg`（可选）
- 组件：`src/components/home/HeroVideo.tsx`
- 无视频时：渐变遮罩仍生效，只是看不到动态画面

---

## 6. 常用命令

```bash
cd F:\blog\selfblog-next
npm.cmd run dev          # 开发（PowerShell 若报脚本策略，用 npm.cmd）
npm.cmd run build        # 构建 → out/
python serve.py          # 本地预览静态站（多线程，端口 3000）
```

## 6.1 GitHub Pages 自动部署

- **仓库**：https://github.com/Orlando-Lin/selfblog
- **工作流**：`.github/workflows/deploy.yml`（push 到 `main` 自动构建并发布 `out/`）
- **自定义域名**：`public/CNAME` → `www.virongx.com`（构建后复制到 `out/CNAME`）

**GitHub 仓库需一次性设置**（网页端）：

1. Settings → Pages → **Build and deployment** → Source 选 **GitHub Actions**
2. Settings → Pages → **Custom domain** 填 `www.virongx.com`（若尚未配置）
3. 首次 push 后，Actions 页查看 `Deploy to GitHub Pages` 是否绿色通过

---

## 7. 目录结构（精简）

```
selfblog-next/
├── content/posts/          # 文章 Markdown
├── public/hero/          # Hero 视频资源
├── src/
│   ├── app/              # 页面路由
│   ├── components/
│   │   ├── blog/         # BlogHub、下拉、PostToc
│   │   ├── home/         # NormalHome、GeekHome、HeroVideo
│   │   └── controls/     # 模式/语言/主题切换
│   └── lib/
│       ├── posts.ts      # 文章读取与检索
│       ├── i18n.ts       # 中英词典
│       └── site.ts       # 站点与导航
├── HANDOFF.md            # 本文件
└── next.config.ts        # 静态导出配置
```

---

## 8. 待办（用户已知）

- [ ] 工具箱 `/toolbox` 实际内容
- [ ] 非遗 `/heritage` 实际内容
- [ ] 博客页旧路由 `/projects` `/about` `/hzbar` 是否删除
- [x] 接入原 `selfblog` git 仓库 + GitHub Actions 自动部署（见 §6.1）
- [ ] GitHub 网页端：Pages → Source 改为 GitHub Actions
- [ ] 替换 Hero 视频与用户真实作品/文章

---

## 9. 给 AI 的提示

1. 改 UI 先看 `globals.css` 设计 token 与 `i18n.ts`
2. 加文章只改 `content/posts/`，不要硬编码进 TSX
3. 静态导出：**不要**用服务端 API、动态 SSR（除 build 时 `generateStaticParams`）
4. 分页/搜索/Tab 在客户端完成（`BlogHub`）
5. 改完跑 `npm run build` 验证
