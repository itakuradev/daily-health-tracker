import { useEffect, useState } from 'react';
import ErrorBanner from './ErrorBanner';
import { useWorkout } from '../hooks/useWorkout';
import type { UpsertWorkoutPayload } from '../types/api';

interface Props {
  date: string;
}

export default function WorkoutForm({ date }: Props) {
  const { record, loading, saveStatus, errorMessage, save } = useWorkout(date);
  const [memo, setMemo] = useState('');

  useEffect(() => {
    setMemo(record?.memo ?? '');
  }, [record]);

  const handleReset = () => setMemo('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpsertWorkoutPayload = {
      date,
      memo: memo !== '' ? memo : undefined,
    };
    void save(payload);
  };

  if (loading) return <p style={s.hint}>読み込み中...</p>;

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.field}>
        <label style={s.label}>トレーニングメモ</label>
        <textarea
          style={s.textarea}
          rows={5}
          placeholder={'例）\nスクワット 3×10\nベンチプレス 3×8 (60kg)\n腕立て 3×15'}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      <div style={s.actions}>
        <button type="button" style={s.resetButton} onClick={handleReset}>
          リセット
        </button>
        <button type="submit" style={s.saveButton} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? '保存中...' : '保存'}
        </button>
      </div>

      {saveStatus === 'saved' && <p style={s.successMsg}>✅ 保存しました</p>}
      <ErrorBanner message={saveStatus === 'error' ? errorMessage : null} />
    </form>
  );
}

const s: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: '#666', fontWeight: 600 },
  textarea: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 13,
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.6,
  },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  resetButton: {
    padding: '8px 20px',
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#fff',
    color: '#555',
    cursor: 'pointer',
    fontSize: 14,
  },
  saveButton: {
    padding: '8px 24px',
    border: 'none',
    borderRadius: 6,
    background: '#43a047',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  successMsg: { color: '#2e7d32', fontSize: 13, textAlign: 'right' },
  errorMsg: { color: '#c62828', fontSize: 13, textAlign: 'right' },
  hint: { color: '#aaa', fontSize: 13 },
};
