import type { SelectHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './SelectField.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  options: SelectOption[];
}

/**
 * native select をベースにした共通ドロップダウン。
 * a11y・モバイル操作を native に委ね、見た目のみ整える。
 */
export function SelectField({
  label,
  options,
  id,
  className,
  ...rest
}: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const cls = [styles.select, className].filter(Boolean).join(' ');
  return (
    <div className={styles.wrap}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.control}>
        <select id={selectId} className={cls} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
      </div>
    </div>
  );
}
