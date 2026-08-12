import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** ラベル左に表示するアイコン（lucide-react 等） */
  icon?: ReactNode;
}

/**
 * 共通ボタン。
 * Primary: アクセントカラー。Secondary: 白背景＋border の控えめなスタイル。
 * hover / focus / disabled 状態は Button.module.css で定義する。
 */
export function Button({
  variant = 'primary',
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [styles.btn, styles[variant], className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </button>
  );
}
