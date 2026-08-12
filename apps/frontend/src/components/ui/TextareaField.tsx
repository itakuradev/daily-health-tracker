import type { TextareaHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import styles from './TextareaField.module.css';

interface TextareaFieldProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
}

/**
 * label + textarea の共通フォーム項目（メモ入力など）。
 */
export function TextareaField({
  label,
  id,
  className,
  rows = 6,
  ...rest
}: TextareaFieldProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const cls = [styles.textarea, className].filter(Boolean).join(' ');
  return (
    <div className={styles.field}>
      <label htmlFor={areaId} className={styles.label}>
        {label}
      </label>
      <textarea id={areaId} rows={rows} className={cls} {...rest} />
    </div>
  );
}
