# 项目上下文

## 项目简介

「脑力慢养」：面向老年用户的家庭脑力训练 H5 单页应用（**纯前端，无任何后端代码**）。3 个游戏（找一找 / 数口令 / 配一对），数据全本地（localStorage + IndexedDB），TTS 播报 + WebAudio 合成音效。

**依据文档**：`DESIGN.md`（视觉与交互规范）+ `src/lib/constants.ts`（PRD §0 常量 / 难度表 / 逐字文案）。PRD 文档本体不在仓库内，文案与数值以这两个文件的现状为准，禁止凭记忆改动。不要引入后端、数据库或任何 API 调用。

## 技术栈

- React 19 + TypeScript strict + Vite 7（纯前端 SPA，无 Express）
- Tailwind CSS（尺寸规范：可点 ≥64px、主按钮 88px、正文 ≥24px、数字 ≥72px，全部用 rem 支持特大字档 ×1.15）

## 命令

- `pnpm dev`：原生 vite 开发服务器（端口 5000，前台运行，HMR 正常）。幂等可重复跑。
- `pnpm build`：产出**纯静态** `dist/`（仅 index.html + assets，无 node 依赖、无 dist-server）。这就是唯一的打包命令。
- `pnpm preview`：本地静态预览 dist（端口 4173，自带 SPA fallback）。
- `pnpm validate`：一次性跑 `ts-check` + `eslint . --quiet` + `stylelint src/**/*.css`（concurrently）。改动后必须用它验证。
- 无测试框架；`pnpm ts-check` 是最快的单步验证。

## 目录结构

```
├── src/
│   ├── main.tsx            # React 入口（挂载 #app）
│   ├── App.tsx             # 路由分发 + TTS/音效手势解锁 + 特大字档应用
│   ├── index.css           # 设计 Tokens + bf-* 动效类（fade-in/rise/pop/press/float）
│   ├── lib/
│   │   ├── constants.ts    # PRD §0 常量 + A/B/C 难度表 + 素材池 + 全部文案
│   │   ├── types.ts        # localStorage/IndexedDB 数据结构（PRD §10）
│   │   ├── storage.ts      # localStorage 读写（settings/progress/daily/levelPool/flags）
│   │   ├── db.ts           # IndexedDB session_log（含配额自整理）
│   │   ├── router.tsx      # 极简 history 路由 + hash 深链接（/…/mindx/ 上页面 URL 为 #/game/:id 形态）
│   │   ├── stats.ts        # session_log 聚合（周统计/箭头/鼓励语/成就句数据）
│   │   ├── tts.ts          # TTS 引擎（首次手势解锁、可关、语速 0.7–1.3、静默降级）
│   │   ├── audio.ts        # WebAudio 合成音效（成功三音/柔和二音）
│   │   └── utils.ts        # 日期/随机/CSV 转义工具
│   ├── components/ui.tsx   # PageShell/PrimaryButton/SoftButton/HomeButton/TopInfo/Card/ConfirmDialog
│   ├── pages/              # Home(P1) / Game(P2 容器) / SetEnd(P3) / DailyDone(P4) / Records(P5)
│   └── games/              # GameA 找一找 / GameB 数口令 / GameC 配一对
├── DESIGN.md               # 视觉与交互设计规范
├── index.html              # 入口 HTML（viewport 防缩放）
└── vite.config.ts          # @vitejs/plugin-react（极简，端口 5000）
```

## 关键机制

- **难度自适应**：`bf_level_pool` 跨局持久化。A/B：连对 4 题 LEVEL+1，局内错 ≥3 题 LEVEL-1，答错后下一题临时降级；A 另有 showMs 连续量微调（答对 ×0.85 / 答错 ×1.2，夹紧 [级标称×0.8, 上一级标称]）。C 只随完成局数 +1（上限 L4）。
- **进度恢复**：每题/每手牌实时写 `bf_progress`；回家/刷新后 P1 出现「继续刚才的」，恢复时当前题重新展示（不重复计分）；隔天丢弃仅继承级别。**打开/刷新时 URL 落在 `/game/:id` 会被 App.tsx replace 回 `/`**（不自动开局，等用户点「继续刚才的」或选游戏）。
- **日结算**：局结束写日志后，当日 ≥3 局或 ≥10 分钟 → 自动进 P4（同日仅一次，`bf_flags.p4ShownDate` 标记）。
- **TTS**：`initTtsOnGesture()` 在首次 pointerdown 解锁；`speak()` 默认打断式；ttsOn=false 时全部静默。

## 部署要点

- `pnpm build` 产物 `base: './'`，可放任意子目录；进游戏后 URL 是 `目录#/game/:id` hash 形态，**刷新命中的永远是目录 index.html，任何静态托管（包括无 SPA fallback 的 kmlab.tech/h5_tools/）都不会 404**。
- 入口已内联守卫：无尾斜杠访问 `…/mindx` 会自动补斜杠，避免相对资源解析到上级目录。
- 若托管端**有** SPA fallback，刷新 `/…/game/A` 这种旧式路径也能被 `parsePath` 识别并弹回首页。

## 开发规范

- **仅允许使用 pnpm**，严禁 npm/yarn（`preinstall` 脚本会拒绝其他包管理器）。
- 使用 Tailwind CSS 进行样式开发；颜色用 DESIGN.md 的暖调 Token（禁纯红、禁倒计时、禁"错误/失败"字样）。
- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。
- 文案修改必须对照 PRD 逐字稿（constants.ts 的 TEXTS 集中管理）。
