# 脑力慢养

「脑力慢养」— 面向长辈的家庭脑力训练 H5。三款小游戏（找一找 / 数口令 / 配一对）全程语音引导，难度自适应、进度本地恢复；**纯前端、无后端**，数据全存浏览器本地（localStorage + IndexedDB），打包后任意静态托管、甚至双击 `index.html` 打开即可使用。

## 技术栈

- React 19 + TypeScript (strict) + Vite 7
- Tailwind CSS 3（暖色调，适老大字号、特大字档 ×1.15）
- 语音朗读（浏览器 TTS）+ WebAudio 合成音效

## 快速开始

```bash
pnpm install     # 必须使用 pnpm（preinstall 脚本强制）
pnpm dev         # 开发服务器 http://localhost:5000，带热更新
pnpm build       # 产出纯静态 dist/ 目录
pnpm preview     # 本地预览 dist/（自带 SPA fallback，端口 4173）
pnpm validate    # 一次性跑 tsc + eslint + stylelint 校验
```

## 部署

`pnpm build` 生成的 `dist/` 是纯静态文件夹（`base: './'` 相对资源），可直接部署到任意静态托管的任意子目录（GitHub Pages、Nginx、Vercel、对象存储 + CDN 等），也可以双击 `index.html` 本地使用。

路由为 hash 形态（如 `…/mindx/#/game/A`），刷新时命中的永远是目录里的 `index.html`，**任何静态托管都不会 404**，无需配置 SPA fallback。

## 目录结构

```
├── src/
│   ├── main.tsx / App.tsx   # 入口：路由分发 + TTS/音效手势解锁 + 特大字档
│   ├── index.css            # 设计 Tokens + bf-* 动效类
│   ├── lib/                 # 路由 / 存储（localStorage + IndexedDB）/ TTS / 音效 / 统计
│   ├── components/ui.tsx    # 页面骨架与通用组件
│   ├── pages/               # P1 首页 / P2 游戏容器 / P3 局末 / P4 日结算 / P5 记录
│   └── games/               # GameA 找一找 / GameB 数口令 / GameC 配一对
├── DESIGN.md                # 视觉与交互设计规范（改样式前必读）
└── vite.config.ts
```

## 开发规范

- 文案与难度数值以 `src/lib/constants.ts` 为唯一事实来源，改动前对照 `DESIGN.md`。
- 适老尺寸：可点区域 ≥64px、主按钮 88px、正文 ≥24px、数字 ≥72px，单位用 rem。
- 禁止纯红、倒计时、"错误/失败" 等负面色彩或字样。
- 必须使用 pnpm，严格 TypeScript（无隐式 any）。
