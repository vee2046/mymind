// ABOUTME: 共享 UI 组件（页面壳 / 主按钮 / 回家按钮 / 卡片 / 弹窗）
// ABOUTME: 尺寸规范：可点 ≥64px，主按钮 88px，间距 ≥16px（G-02）

import type { ReactNode } from 'react';
import { goHome } from '../lib/router';

/** 页面壳：移动优先、桌面居中、安全区适配 */
export function PageShell({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pt-6 pb-[calc(120px+env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

/** 88px 全宽主按钮（陶土橘 / 米灰 / 中性灰） */
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  tone = 'primary',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'soft' | 'gray';
}): React.JSX.Element {
  const palette =
    tone === 'primary'
      ? 'bg-[#C2703E] text-white active:bg-[#A95F32]'
      : tone === 'gray'
        ? 'bg-[#E4DACB] text-[#8A7D6E]'
        : 'bg-[#F3EDE3] text-[#3E342B] active:bg-[#E4DACB]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bf-press flex h-[88px] w-full items-center justify-center rounded-2xl text-[1.75rem] font-semibold shadow-[0_4px_16px_rgb(62_52_43/0.12)] ${palette} ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      {children}
    </button>
  );
}

/** ≥64px 次级按钮 */
export function SoftButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bf-press flex min-h-[64px] items-center justify-center gap-2 rounded-2xl border border-[#E4DACB] bg-[#F3EDE3] px-6 text-[1.5rem] font-medium text-[#3E342B] shadow-[0_2px_8px_rgb(62_52_43/0.05)] ${className}`}
    >
      {children}
    </button>
  );
}

/** 「🏠 回家」底部左下常驻（P2-R05，安全区内固定） */
export function HomeButton({
  onClick,
}: {
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label="回家"
      onClick={() => {
        if (onClick) {
          onClick();
        } else {
          goHome();
        }
      }}
      className="bf-press fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-4 z-40 flex h-[72px] min-w-[96px] items-center justify-center gap-1 rounded-2xl bg-white px-4 text-[1.375rem] font-semibold text-[#3E342B] shadow-[0_4px_16px_rgb(62_52_43/0.16)]"
    >
      <span aria-hidden className="text-[1.75rem]">🏠</span>
      回家
    </button>
  );
}

/** P2 顶部信息（P2-R04）：游戏名 · 第n题/5 · Lx */
export function TopInfo({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center">
      <p className="rounded-full bg-white px-6 py-2 text-[1.375rem] font-medium text-[#3E342B] shadow-[0_2px_8px_rgb(62_52_43/0.08)]">
        {text}
      </p>
    </div>
  );
}

/** 通用卡片（无默认内边距，由调用方控制） */
export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`rounded-2xl bg-white shadow-[0_4px_16px_rgb(62_52_43/0.08)] ${className}`}>
      {children}
    </div>
  );
}

/** 双确认弹窗（F-P5-07 等）：两按钮均 ≥64px */
export function ConfirmDialog({
  title,
  body,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <div
      className="bf-fade-in fixed inset-0 z-50 flex items-center justify-center bg-[#3E342B]/40 px-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-[0_8px_32px_rgb(62_52_43/0.2)]">
        <p className="text-center text-[1.625rem] font-semibold">{title}</p>
        {body ? (
          <p className="mt-3 text-center text-[1.25rem] leading-relaxed text-[#8A7D6E]">{body}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-4">
          <button
            type="button"
            onClick={onConfirm}
            className="bf-press flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-[#C2703E] text-[1.5rem] font-semibold text-white"
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bf-press flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-[#F3EDE3] text-[1.5rem] font-medium text-[#3E342B]"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
