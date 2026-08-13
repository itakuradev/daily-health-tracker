import ErrorBanner from '../ErrorBanner';
import { Button } from './Button';
import styles from './FormActions.module.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FormActionsProps {
  saveStatus: SaveStatus;
  errorMessage: string | null;
  onReset: () => void;
}

/**
 * フォーム共通の操作行（リセット / 保存）＋保存ステータス表示。
 * 保存ボタンは submit。保存中は無効化する。
 */
export function FormActions({ saveStatus, errorMessage, onReset }: FormActionsProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.buttons}>
        <Button variant="secondary" onClick={onReset}>
          リセット
        </Button>
        <Button type="submit" variant="primary" disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? '保存中...' : '保存'}
        </Button>
      </div>
      {saveStatus === 'saved' && <p className={styles.saved}>保存しました</p>}
      <ErrorBanner message={saveStatus === 'error' ? errorMessage : null} />
    </div>
  );
}
