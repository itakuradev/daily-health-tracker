import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  /** カード見出し（省略可） */
  title?: ReactNode;
  /** 見出し左のアイコン */
  icon?: ReactNode;
  /** 見出し右に置く要素（削除導線など） */
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 共通カード。白背景・角丸・薄border・控えめshadow。
 */
export function Card({ title, icon, headerActions, children, className }: CardProps) {
  const cls = [styles.card, className].filter(Boolean).join(' ');
  return (
    <section className={cls}>
      {(title || headerActions) && (
        <div className={styles.header}>
          {title && (
            <h2 className={styles.title}>
              {icon && <span className={styles.icon}>{icon}</span>}
              {title}
            </h2>
          )}
          {headerActions && <div className={styles.actions}>{headerActions}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
