// ABOUTME: 应用骨架：初始化 TTS/音效解锁、特大字档应用、路由分发
// ABOUTME: 5 个视图（P1 首页 / P2 游戏内 / P3 局末 / P4 日结算 / P5 记录）

import { useEffect, useRef } from 'react';
import { initTtsOnGesture } from './lib/tts';
import { initAudioOnGesture } from './lib/audio';
import { navigate, useRoute } from './lib/router';
import { loadSettings } from './lib/storage';
import Home from './pages/Home';
import Game from './pages/Game';
import SetEnd from './pages/SetEnd';
import DailyDone from './pages/DailyDone';
import Records from './pages/Records';
import SettingsPage from './pages/Settings';

/** 特大字档：toggle 后立即全局生效（×1.15），无重载（F-P5-08） */
export function applyFontScale(): void {
  const s = loadSettings();
  document.documentElement.classList.toggle('big-font', s.fontSize === 1.15);
}

export default function App(): React.JSX.Element {
  const route = useRoute();
  const handledInitialRoute = useRef(false);

  useEffect(() => {
    initTtsOnGesture();
    initAudioOnGesture();
    applyFontScale();
  }, []);

  // 打开/刷新页面时若 URL 停在游戏路径，回首页等待用户选择；
  // 进行中的局已按题落盘，首页「继续刚才的」可达恢复，不自动开局
  useEffect(() => {
    if (handledInitialRoute.current) return;
    handledInitialRoute.current = true;
    if (route.name === 'game') navigate('/', { replace: true });
  }, [route.name]);

  switch (route.name) {
    case 'game':
      return <Game key={route.id} id={route.id} />;
    case 'end':
      return <SetEnd playId={route.playId} />;
    case 'daily':
      return <DailyDone />;
    case 'records':
      return <Records />;
    case 'settings':
      return <SettingsPage />;
    case 'home':
    default:
      return <Home />;
  }
}
