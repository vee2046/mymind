# 项目上下文

## 项目简介

「脑力慢养」：面向老年用户的家庭脑力训练 H5 单页应用。**纯前端，无后端、无数据库、无任何 API 调用**。4 个游戏（找一找 / 数口令 / 配一对 / 赶集），数据全本地（localStorage + IndexedDB），TTS 播报 + WebAudio 合成音效，图形素材只用系统 emoji（仓库无任何图片/字体文件）。

**事实来源只有两处**：`src/lib/constants.ts`（PRD §0 常量 / A·B·C·D 难度表 / 全部文案 `TEXTS`）+ `DESIGN.md`（视觉与交互规范）。PRD 原件不在仓库内——数值与文案以这两处现状为准，禁止凭记忆改动。

## 技术栈

React 19 + TypeScript strict + Vite 7 + Tailwind 3。纯 SPA，**无测试框架**，验证靠 `ts-check` + `eslint` + `stylelint`。

## 命令

- `pnpm dev`：vite dev server，端口 **5000**，`server.host: true`（同网段手机可直接访问）。幂等可重复跑。⚠️ 本机 5000 常被 macOS ControlCenter（AirPlay 接收）占着，端口冲突时改用 `--port 5001`。
- `pnpm build`：产出**纯静态** `dist/`（`base: './'`）。这是唯一的打包命令，产物已在 `.gitignore` 中。
- `pnpm preview`：本地静态预览 dist（端口 4173）。
- `pnpm validate`：`pnpm dlx concurrently` 并行跑 `ts-check` + `lint:build` + `lint:style`。⚠️ **concurrently 不是本地依赖，每次会联网下载**；离线环境改跑下面三条单命令。
- `pnpm ts-check`（`tsc -p tsconfig.json`，**只 include `src/`**，根目录配置文件不在类型检查范围内）、`pnpm lint:build`（`eslint . --quiet`）、`pnpm lint:style`（`stylelint "src/**/*.css"`）。改完至少跑 `pnpm ts-check`。
- 裸 `pnpm lint`（无 `--quiet`）会额外报 2 条**既有** warning（`GameA.tsx:203`、`GameC.tsx:76` 的 unused eslint-disable 指令），非新改动引入，`lint:build` 已过滤。
- **仅允许 pnpm**（`preinstall` 是 `only-allow pnpm`）；`.npmrc` 指向 registry.npmmirror.com。

## 目录结构

```
src/
├── main.tsx            # React 入口（挂载 #app）
├── App.tsx             # 路由分发 + TTS/音效手势解锁 + 特大字档应用 + 初始 /game/* 弹回首页
├── index.css           # 设计 Tokens（CSS 变量）+ bf-* 动效类（fade-in/rise/pop/press/float/stage）
├── lib/
│   ├── constants.ts    # PRD §0 常量 + A/B/C/D 难度表 + 素材池 + 全部文案（唯一数值/文案来源）
│   ├── types.ts        # localStorage/IndexedDB 数据结构（PRD §10）
│   ├── storage.ts      # localStorage 读写：bf_settings/progress/daily/level_pool/flags
│   ├── db.ts           # IndexedDB `brainfit-db` → `session_log`（配额超限自动删最老 50 条重试，最多 6 轮）
│   ├── router.tsx      # 极简 history 路由 + hash 深链接（pushState 失败自动退回 hash）
│   ├── stats.ts        # session_log 实时聚合（周统计/箭头/鼓励语/成就句）
│   ├── market.ts       # GameD「赶集」纯生成器：规则/摊位/改口/算账题（不依赖 React）
│   ├── tts.ts          # TTS 引擎（首次手势解锁、可关、语速 0.7–1.3、静默降级）
│   ├── audio.ts        # WebAudio 合成音效（成功三音/柔和二音，无音频文件）
│   └── utils.ts        # 日期/随机/CSV 转义工具
├── components/ui.tsx   # PageShell/PrimaryButton/SoftButton/HomeButton/TopInfo/Card/ConfirmDialog/ToggleRow/AudioToggles/GameHeader
├── pages/              # Home(P1) / Game(P2 容器) / SetEnd(P3) / DailyDone(P4) / Records(P5) / Settings(P6)
└── games/              # GameA 找一找 / GameB 数口令 / GameC 配一对 / GameD 赶集
```

## 关键机制

- **难度自适应**（`bf_level_pool` 跨局持久化）。级别范围：A L1–8 / B L1–10 / C L1–4 / D L1–8，起始 L2，每局 5 题（`SET_SIZE`）。
  - A/B：连对 4 题（`UP_STREAK`）→ LEVEL+1；**本局答对 ≤2 题（即错 ≥3 题）→ 局末 LEVEL-1**；答错后**下一题临时用 LEVEL-1 参数**出题。
  - A 另有 showMs 连续量微调：答对 ×0.85（下限 = 本级标称 ×0.8），答错 ×1.2（上限 = 上一级标称）；升级时重置为 `aInitialShowMs(level)`。
  - C：难度只随**完成局数 +1**（上限 L4），无对错概念。
  - D：规则同 A/B（连对 4 题升级、局末答对 ≤2 降级、答错后下一题用 LEVEL-1），但难度参数由 `D_LEVELS` 的**规则种类**驱动（见下）。
- **进度恢复**：每题 / 每手牌实时写 `bf_progress`；**仅当天有效**（隔天丢弃，级别仍由 level_pool 继承）；恢复时当前题重新展示，**不重复计分**（E-02）。首页「继续刚才的」卡与主按钮都会恢复；四个游戏卡则 `clearProgress()` 后新开一局。
- **初始路由守卫**：`App.tsx` 在打开/刷新时若 URL 落在 `/game/:id` 会 `navigate('/', {replace:true})` 弹回首页——**不自动开局**，必须由用户点「继续刚才的」或游戏卡。
- **日结算（P4）**：局结束写日志 → 更新 `bf_daily`（当日 ≥3 局 `DAILY_LIMIT_SETS` 或 ≥10 分钟 `DAILY_LIMIT_MS`）→ 自动跳 `/daily-done`，**同日仅一次**（`bf_flags.p4ShownDate`）。
- **P3/P4 的结果不是存的汇总表**，而是每次从 IndexedDB `session_log` 实时聚合（`stats.ts`）。新增游戏时必须保证日志字段（level/seq/isCorrect/answer/target/durationMs/movesCount）完整，否则 P3/P4 显示不出来。
- **P3/P4 页面里「回家」只有一个**：用结算区内的 `SoftButton`，**不要再加浮动的 `<HomeButton/>`**（曾出现两个重复按钮，已删浮动那个）。
- **TTS**：`initTtsOnGesture()` 在首次 `pointerdown` 解锁；`speak()` 每次 `cancel()` 旧播报（打断式）；`ttsOn=false` 时全部静默；语速 clamp 到 0.7–1.3。
- **语音 / 音效开关**：`bf_settings.ttsOn` 与 `bf_settings.sfxOn` **默认都是关闭**（`loadSettings` 只认显式存过的 `true`）。唯一出口：TTS 走 `tts.ts` 的 `speak()`，音效走 `audio.ts` 的 `tone()`——两个函数各自查开关，所以 4 个游戏里不用加任何判断。音效关闭时连 `AudioContext` 都不创建；`primeAudio()` 用于「刚打开开关」这一次点击里创建/恢复 AudioContext（浏览器自动播放策略）。
- **设置页（P6 `/settings`）**：语音播报 / 音效 / 语速 / 特大字。入口在首页和记录页；`router.tsx` 的 `ROUTE_TOKENS` 已加 `settings`。特大字直接切 `<html class="big-font">`——**不要从 `App.tsx` 导入 `applyFontScale`**（App 依赖 pages，会形成 import 环）。
- **游戏内快捷开关**：`components/ui.tsx` 的 `AudioToggles`（🎤语音 / 🔔音效 圆片，≥64px）渲染在 4 个游戏 `<GameHeader/>` 正下方，与设置页共用同一份 `bf_settings`。**只能放正文流里**：右上角会压住 GameA 外周目标，右下角会压住 GameB「说完了」按钮。
- **游戏页顶部栏 `GameHeader`**：`sticky top-0` + 背景色，内含左上角 64×64 纯图标「回家」按钮（`HomeButton placement="inline"`）+ 右侧 compact 胶囊（`TopInfo compact`）。**游戏页不要再自己放 `<HomeButton/>`**（`pages/Game.tsx` 已删）；`HomeButton` 默认的 `floating-bottom`（左下悬浮）只给记录页/设置页用。
- **GameA 外周图形用固定 3×3 CSS 网格**（`DIR_CELL` 映射方向 → 行列），每格最多一个图形，结构上不可能重叠；中央图标 6.75rem（重演 7.25rem）、外周目标 5rem、干扰项 3rem + opacity-40。`constants.ts` 里的 `ALevelSpec.ringRatio` **只是 PRD 原值，已不参与渲染**——不要再改回极坐标环形排布（手机上必然互相压住）。
- **B 局去重**：同局 5 串互不重复，首题还与上一局首题（`bf_flags.lastBFirst`）不重复。
- **GameD「赶集」（🧺）＝ 执行功能训练**（A=视觉搜索 / B=言语工作记忆 / C=再认记忆，**D 补上前三个完全没覆盖的执行功能域**：反应抑制、规则切换、工作记忆更新、语义选择、心算）。
  - 场景：你是老主顾，摊主（老板）先说规矩，你照规矩挑货；摊主有时**改主意**（改口），最后还要**算账**。
  - 规则 5 类（`DRuleKind`）：`category`「今天只要水果」/ `union`「水果和蔬菜都要」/ `attribute`「只要能喝的」/ `except`「只要水果，除了草莓」/ `negation`「除了草莓，其余都要」；另有 `sum` 算账题。
  - **改口 = 经典 invalidation-cue 切换范式**：玩家**第一次点货**时摊主改规矩（规则 A → 规则 B，**货架不变**），弹出「等等，改主意了」+ 蜂蜜色「改过主意」标签；该次点击**不计入选择**。所以「挑好了」按钮在有选择前**必须禁用**（`canSubmit`），保证改口永远先于提交发生。
  - **规则呈现随等级退化**（`DLevelSpec.ruleDisplay`）：L1–3 整张卡片、L4–6 细条（`rule.short`）、L7–8 **收起来**（只剩「👀 想起来了」按钮，点开 2.5 秒）→ 高等级逼玩家把规矩存在工作记忆里。
  - **命中集唯一真源是 `targetIds(rule, items)`**（`market.ts`）：`attribute` 按 attr 取、`negation` 取全集、其余按 cat 取，再扣掉 `exclude`。**陪衬商品（filler）绝不允许命中规则**（`fillerAllowed`），否则会出现第二个正确答案；`fillStall` 还会预留「另一类可规则类目 + 一件带属性商品」作为改口素材。
  - 算账题：2–4 件商品、单价不同、答案 ≤99 元、4 个选项（`makeOptions` 保证含正确答案且互不相同）。选项点选后**还要按「就这些」才提交**——给手抖的长辈一次改口机会。
  - 反馈：答对=苔绿「挑得真准，就这么办。」；答错=柔和二音 + 白卡「我们再看一遍」+「该拿：苹果、梨」/ 算账时列出 `单价＋单价＝一共 N 元`，命中项打苔绿 ✓、其余标「不用拿」。**全程无红色、无负向词**。
  - 生成器是纯函数（`market.ts` 不依赖 React），可单独 fuzz 验证；已验证 1.6 万局：目标集非空且 ⊆ 货架、filler 从不命中、改口必产生**不同**命中集的新规则、算账答案与选项恒正确。
  - 进度：`ProgressD{gameId:'D',level,qIndex,score,plan,startedAt}`——**把 5 题计划（题型 + 是否改口）一起存**，恢复时按计划重生成当轮题目，不重复计分。
  - `Records.tsx` 的 `GAME_IDS` 必须包含 `'D'`，否则本周记录不显示赶集；`DailyDone.tsx` 的成就句用 `TEXTS.dDaily(今天, 昨天)`（只与本人昨天比）。
- **GameE「数字找家」（🏠）＝ 数感训练**（数轴估计 / 数字↔空间映射 / 比例推理）。点数线放数字 →「放好了」确认（可重点点调整）；**容差判对**（`ELevelSpec.tolerance`），答错亮 🏠 即时纠错。自适应规则同 A/B（连对 4 升 / 局末 ≤2 降 / 答错下题降一级出题），级别 L1–6（`E_LEVELS`，0–10 → 0–100）。生成器 `genETarget`：目标数避开刻度值、本局不重复。进度 `ProgressE{usedTargets}`。集成点与 D 相同：`Records.GAME_IDS` 含 `'E'`、`DailyDone` 成就句、`router.tsx` parsePath 与 BASE_DIR 正则 `[ABCDE]`、`storage.ts` lastGameId/level_pool/progress 校验。
- **数口令反向算法**：`BLevelSpec.reverse` 从「本级恒反向」改为「本级允许反向」——L1–3 恒顺说，L4 起每题抛硬币（50/50），`GameB.decideReverse` 保证不连续 3 题同向（`modeRef`）；本题模式存 `GS.qReverse`，不落盘（恢复时当题重新出）。

## 部署要点

- `pnpm build` 产物 `base: './'`，可放任意子目录；**深链接统一走 hash**（`目录#/game/:id`），刷新命中的永远是目录 index.html，任何静态托管（包括无 SPA fallback 的 `kmlab.tech/h5_tools/`）都不会 404。
- `index.html` 内联守卫：无尾斜杠访问 `…/mindx` 会自动补斜杠，避免相对资源解析到上级目录。
- 托管端**有** SPA fallback 时，刷新 `/…/game/A` 这类旧式路径会被 `parsePath`（按路由 token 扫描，兼容任意部署前缀）识别，再由 App 弹回首页。
- `file://` 双击打开时 `pushState` 抛错，`router.tsx` 自动退回 hash 路由，功能不受影响。

## 上线流程（mymind → h5_tools）

- 产物仓库在**同级目录** `/Users/wuwei/Documents/dev/h5_tools`（纯静态、无源码；`mindx/` 就是本项目产物镜像）。**不要**在里面跑 `pnpm install/dev`，**不要**手改构建产物。
- 步骤：`pnpm build` → `rm -rf h5_tools/mindx/assets h5_tools/mindx/index.html` → `cp -R mymind/dist/. h5_tools/mindx/` → 在 h5_tools 里 `git add -A && git commit -m "update: mindx页面刷新构建产物（…）" && git push origin main` → 再回 mymind `git push origin main`。产物文件名每次 build 都会变，必须整目录替换。
- 两个仓库的 origin 都是 SSH `git@github.com:vee2046/…`；本机 `~/.ssh/config` 已把 `github.com` 映射到 `ssh.github.com:443`（直连 github.com:22 超时）。**不要**把 token 写进 remote URL。
- kmlab_site（`/Users/wuwei/Documents/dev/kmlab_site`，Gitee）另有 `public/data/html_files.json` 索引，**尚未登记 mindx**，需要另开改动时先跟用户确认。

## 开发规范

- **仅允许 pnpm**，严禁 npm/yarn。
- 样式用 Tailwind，但**颜色必须用 DESIGN.md 的暖调 Token**（页面 `#FAF6EF`、文字 `#3E342B`/`#8A7D6E`、主按钮 `#C2703E`、正反馈 `#5C8A5A`）。
- **禁止**：纯红、倒计时、进度压力条、百分比、人比人对比、"错误/失败/太慢/错过"等负向文案、弹系统键盘、横向滚动、深色模式。
- 适老尺寸（全部用 **rem**，特大字档靠 `<html class="big-font">` ×1.15 整体放大）：可点 ≥64px、主按钮 88px、正文 ≥24px、数字 ≥72px。
- 动效只允许淡入淡出与位移（`cubic-bezier(0.22, 1, 0.36, 1)`，阶段切换 600ms），禁止弹跳/旋转/闪烁；`prefers-reduced-motion` 已全局降级。
- TypeScript strict：无隐式 `any`、无 `as any`；参数/返回值/解构项/事件对象/`catch` 错误都要有明确类型或先收窄；清理未使用的变量和导入。
- **eslint `import/no-cycle` 是 error**：`lib/` 内部模块不要形成循环依赖。
- 文案改动必须落到 `constants.ts` 的 `TEXTS` / `P3_PRAISE` / `WEEKLY_PRAISE`，不要在组件里内联硬编码。
