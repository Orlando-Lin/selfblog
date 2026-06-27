export type Bi = { zh: string; en: string };

export type Work = {
  year: string;
  title: Bi;
  desc: Bi;
  tags: string[];
  link?: string;
};

export const works: Work[] = [
  {
    year: "2026",
    title: { zh: "VIRONGX 个人站", en: "VIRONGX Personal Site" },
    desc: {
      zh: "基于 Next.js 与 Tailwind 打造的双模式个人站，支持普通/极客主页、中英与亮暗切换。",
      en: "A dual-mode personal site built with Next.js & Tailwind — editorial/geek homepages, bilingual and themeable.",
    },
    tags: ["Next.js", "TypeScript", "Tailwind"],
    link: "https://github.com/Orlando-Lin/selfblog",
  },
  {
    year: "2025",
    title: { zh: "组件设计系统", en: "Component Design System" },
    desc: {
      zh: "一套强调可访问性与主题定制的 React 组件库。占位作品，替换为你的真实项目。",
      en: "An accessible, themeable React component library. Placeholder — replace with your real work.",
    },
    tags: ["React", "Storybook", "a11y"],
  },
  {
    year: "2025",
    title: { zh: "实时数据看板", en: "Realtime Dashboard" },
    desc: {
      zh: "面向实时数据流的可视化看板，支持自定义图表与暗黑主题。占位作品。",
      en: "A visualization dashboard for realtime data streams with custom charts and dark mode. Placeholder.",
    },
    tags: ["D3", "WebSocket", "ECharts"],
  },
];

export type Project = {
  title: string;
  description: string;
  tags: string[];
  link?: string;
  status: "进行中" | "已上线" | "实验";
};

export const projects: Project[] = [
  {
    title: "VIRONGX 个人站",
    description:
      "基于 Next.js 16 + Tailwind v4 打造的个人博客与数字花园，毛玻璃质感、暗黑模式、丝滑动效。",
    tags: ["Next.js", "TypeScript", "Tailwind"],
    link: "https://github.com/Orlando-Lin/selfblog",
    status: "进行中",
  },
  {
    title: "示例开源组件库",
    description:
      "一套可复用的 React UI 组件，强调可访问性与主题定制。占位项目，替换为你的真实作品。",
    tags: ["React", "Storybook", "a11y"],
    status: "实验",
  },
  {
    title: "数据可视化看板",
    description:
      "实时数据流的可视化看板，支持自定义图表与暗黑主题。占位项目，替换为你的真实作品。",
    tags: ["D3", "WebSocket", "ECharts"],
    status: "已上线",
  },
];

export type Skill = { name: string; level: number };

export const skills: Skill[] = [
  { name: "前端工程 / React", level: 90 },
  { name: "TypeScript", level: 85 },
  { name: "Node.js / 后端", level: 75 },
  { name: "UI / 视觉设计", level: 70 },
  { name: "DevOps / 部署", level: 65 },
];

export type Move = {
  name: string;
  level: "入门" | "进阶" | "高手";
  desc: string;
};

// 盘杠：单杠/双杠 街头健身动作清单
export const hzbarMoves: Move[] = [
  { name: "引体向上", level: "入门", desc: "背部与手臂的基础，所有进阶动作的起点。" },
  { name: "双力臂 (Muscle Up)", level: "进阶", desc: "从杠下拉起翻越到杠上，力量与协调的标志动作。" },
  { name: "前水平 (Front Lever)", level: "高手", desc: "身体水平悬挂，极致的核心与背部静力控制。" },
  { name: "俄式挺身 (Planche)", level: "高手", desc: "双手撑地、身体悬空水平，街头健身的终极目标之一。" },
  { name: "人体旗帜 (Human Flag)", level: "高手", desc: "侧身水平挂在竖杆上，全身张力的极致展现。" },
  { name: "暴力上杠组合", level: "进阶", desc: "连续双力臂衔接，爆发力与节奏的训练。" },
];
