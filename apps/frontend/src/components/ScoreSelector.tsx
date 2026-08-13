import { useId } from 'react';
import styles from './ScoreSelector.module.css';

const SCORES = [1, 2, 3, 4, 5] as const;

interface ScoreSelectorProps {
  /** 選択中のスコア（1〜5）。未選択は null */
  value: number | null;
  onChange: (score: number) => void;
}

/**
 * 体調スコア（1〜5）の数値ボタン。
 * 両端にのみアンカー（悪い / 良い）を表示し、各数値には個別ラベルを付けない。
 * 選択中のボタンだけアクセントカラーにする。
 */
export function ScoreSelector({ value, onChange }: ScoreSelectorProps) {
  const labelId = useId();
  return (
    <div className={styles.wrap}>
      <span className={styles.label} id={labelId}>
        体調スコア
      </span>
      <div className={styles.buttons} role="group" aria-labelledby={labelId}>
        {SCORES.map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.btn} ${value === n ? styles.active : ''}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className={styles.anchors} aria-hidden="true">
        <span>悪い</span>
        <span>良い</span>
      </div>
    </div>
  );
}
