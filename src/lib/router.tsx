// ABOUTME: 极简 history 路由（pushState 管理，浏览器返回键等效页面返回）
// ABOUTME: PRD §9 路由表；P3→P2 用 replace 防历史堆积
// ABOUTME: 相对 base 部署：路径自动带上部署前缀；file:// 双击场景退回 hash 路由

import { useEffect, useState } from 'react';
import type { GameId } from './constants';

export type Route =
  | { name: 'home' }
  | { name: 'game'; id: GameId }
  | { name: 'end'; playId: string }
  | { name: 'daily' }
  | { name: 'records' }
  | { name: 'settings' };

/** 路由 token（按位置扫描，兼容任意部署前缀，如 /mindx/game/A） */
const ROUTE_TOKENS = ['game', 'end', 'daily-done', 'records', 'settings'] as const;

export function parsePath(path: string): Route {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  const i = parts.findIndex((p) => (ROUTE_TOKENS as readonly string[]).includes(p));
  if (i === -1) return { name: 'home' };
  const token = parts[i];
  if (token === 'game') {
    const id = parts[i + 1];
    if (id === 'A' || id === 'B' || id === 'C') return { name: 'game', id };
    return { name: 'home' };
  }
  if (token === 'end') {
    const playId = parts[i + 1];
    if (playId) return { name: 'end', playId };
    return { name: 'home' };
  }
  if (token === 'daily-done') return { name: 'daily' };
  if (token === 'settings') return { name: 'settings' };
  return { name: 'records' };
}

/** 当前路由：优先 hash（file:// 双击场景），否则 pathname */
function currentRoute(): Route {
  const hash = window.location.hash;
  if (hash.startsWith('#/')) return parsePath(hash.slice(1));
  return parsePath(window.location.pathname);
}

/**
 * 部署前缀目录（含尾斜杠）。取自首次加载时的 pathname，剥掉入口文件名与路由段：
 *   /                    → /
 *   /mindx/              → /mindx/
 *   /mindx/index.html    → /mindx/
 *   /game/A（刷新落场）   → /
 *   /mindx/game/A        → /mindx/
 */
const BASE_DIR: string = (() => {
  const p = window.location.pathname;
  const m = p.match(/\/(?:game\/[ABC]|end\/[^/]+|daily-done|records)(?:\/|$)/);
  const cut = m && m.index !== undefined ? p.slice(0, m.index + 1) : p;
  return cut.endsWith('/') ? cut : cut.replace(/[^/]*$/, '');
})();

function fullUrl(path: string): string {
  // 深链接统一放 hash：刷新命中的永远是目录 index.html，
  // 在任何静态托管（哪怕没有 SPA fallback，如 kmlab.tech/h5_tools/）都不会 404
  return path === '/' ? BASE_DIR : `${BASE_DIR}#${path}`;
}

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function navigate(path: string, opts?: { replace?: boolean }): void {
  try {
    const url = fullUrl(path);
    if (opts?.replace) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
  } catch {
    // file:// 等场景 pushState 可能失败，退回 hash 路由
    window.location.hash = '#' + path;
    emit();
    return;
  }
  emit();
}

export function goHome(): void {
  navigate('/');
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => currentRoute());
  useEffect(() => {
    const sync = (): void => setRoute(currentRoute());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    listeners.add(sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      listeners.delete(sync);
    };
  }, []);
  return route;
}
