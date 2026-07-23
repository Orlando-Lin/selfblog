---
title: 文章标题（必填）
description: 一句话摘要，用于列表与 SEO（必填）
date: 2026-06-26
category: 技术
tags: [Next.js, 示例]
# cover: /images/covers/example.jpg   # 可选封面图
---

> 以 `_` 开头的文件不会被发布。复制本文件，去掉 `_` 前缀并重命名即可。

## 二级标题会被收录到左侧目录

正文使用 **Markdown** 编写即可，支持：

- 列表、引用、表格（GFM）
- 代码块与语法高亮
- `行内代码`

### 三级标题也会出现在目录里

写完后运行 `npm run build`，文章会自动出现在博客列表。

> **URL 路径**：文件名即 slug，请只用英文字母、数字、连字符与下划线（如 `STM32_CMake-workflow.md`）。中文或 `&` 等特殊字符会导致 GitHub Pages 静态导出 404。

---

## 英文版（可选）

在 `content/posts/en/` 下创建 **同名** 文件（如 `my-post.md`），切换 EN 模式时会显示英文标题、摘要、分类、标签与正文。`date` 可省略，默认沿用中文版。

```yaml
---
title: Post Title
description: One-line summary for list & SEO
category: Tech
tags: [Next.js, Example]
---
```

英文 `tags` 建议与中文版 **顺序一致**，便于分类/标签页双语对应。
