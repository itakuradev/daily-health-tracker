import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import styles from './Field.module.css';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  /** 入力欄右に表示する単位（kcal / kg 等） */
  unit?: ReactNode;
}

/**
 * label + input(+ 単位) の共通フォーム項目。
 * label と input は id で関連付ける（アクセシビリティ）。
 */
export function Field({ label, unit, id, className, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const inputCls = [styles.input, className].filter(Boolean).join(' ');
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputRow}>
        <input id={inputId} className={inputCls} {...rest} />
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
    </div>
  );
}
