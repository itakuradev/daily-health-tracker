import { useEffect, useState } from 'react';
import { useCondition } from '../hooks/useCondition';
import type { UpsertConditionPayload } from '../types/api';

interface Props {
  date: string;
}

interface FormValues {
  weight: string;
  waist: string;
  armCircumference: string;
  sleepHours: string;
  conditionScore: string; // '1'〜'5' or ''
}

const EMPTY: FormValues = {
  weight: '',
  waist: '',
  armCircumference: '',
  sleepHours: '',
  conditionScore: '',
};

const SCORE_LABELS: Record<number, string> = {
  1: '😞 最悪',
  2: '😕 悪い',
  3: '😐 普通',
  4: '🙂 良い',
  5: '😄 最高',
};

function recordToForm(
  record: {
    weight: number | null;
    waist: number | null;
    armCircumference: number | null;
    sleepHours: number | null;
    conditionScore: number | null;
  } | null,
): FormValues {
  if (!record) return EMPTY;
  return {
    weight: record.weight != null ? String(record.weight) : '',
    waist: record.waist != null ? String(record.waist) : '',
    armCircumference: record.armCircumference != null ? String(record.armCircumference) : '',
    sleepHours: record.sleepHours != null ? String(record.sleepHours) : '',
    conditionScore: record.conditionScore != null ? String(record.conditionScore) : '',
  };
}

export default function ConditionForm({ date }: Props) {
  const { record, loading, saveStatus, errorMessage, save } = useCondition(date);
  const [values, setValues] = useState<FormValues>(EMPTY);

  useEffect(() => {
    setValues(recordToForm(record));
  }, [record]);

  const handleChange =
    (field: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleReset = () => setValues(EMPTY);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpsertConditionPayload = {
      date,
      weight: values.weight !== '' ? Number(values.weight) : undefined,
      waist: values.waist !== '' ? Number(values.waist) : undefined,
      armCircumference: values.armCircumference !== '' ? Number(values.armCircumference) : undefined,
      sleepHours: values.sleepHours !== '' ? Number(values.sleepHours) : undefined,
      conditionScore: values.conditionScore !== '' ? Number(values.conditionScore) : undefined,
    };
    void save(payload);
  };

  if (loading) return <p style={s.hint}>読み込み中...</p>;

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.grid}>
        <Field label="体重" unit="kg" step="0.1" value={values.weight} onChange={handleChange('weight')} />
        <Field label="ウエスト" unit="cm" step="0.1" value={values.waist} onChange={handleChange('waist')} />
        <Field label="腕周り" unit="cm" step="0.1" value={values.armCircumference} onChange={handleChange('armCircumference')} />
        <Field label="睡眠時間" unit="h" step="0.5" value={values.sleepHours} onChange={handleChange('sleepHours')} />
      </div>

      {/* 体調スコア: ラジオボタン */}
      <div style={s.scoreSection}>
        <p style={s.scoreLabel}>体調スコア</p>
        <div style={s.scoreRow}>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <label key={n} style={s.scoreItem}>
              <input
                type="radio"
                name="conditionScore"
                value={String(n)}
                checked={values.conditionScore === String(n)}
                onChange={handleChange('conditionScore')}
                style={s.radioInput}
              />
              <span style={{
                ...s.scoreBox,
                ...(values.conditionScore === String(n) ? s.scoreBoxActive : {}),
              }}>
                {SCORE_LABELS[n]}
              </span>
            </label>
          ))}
        </div>
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
      {saveStatus === 'error' && <p style={s.errorMsg}>❌ {errorMessage}</p>}
    </form>
  );
}

function Field({
  label,
  unit,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  step?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <div style={s.inputRow}>
        <input
          type="number"
          min={0}
          step={step}
          style={s.input}
          placeholder="—"
          value={value}
          onChange={onChange}
        />
        <span style={s.unit}>{unit}</span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 12,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: '#666', fontWeight: 600 },
  inputRow: { display: 'flex', alignItems: 'center', gap: 4 },
  input: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    outline: 'none',
  },
  unit: { fontSize: 12, color: '#999', whiteSpace: 'nowrap' },
  scoreSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  scoreLabel: { fontSize: 12, color: '#666', fontWeight: 600, margin: 0 },
  scoreRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  scoreItem: { cursor: 'pointer', display: 'flex', alignItems: 'center' },
  radioInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },
  scoreBox: {
    display: 'inline-block',
    padding: '5px 10px',
    border: '1px solid #ddd',
    borderRadius: 20,
    fontSize: 12,
    color: '#555',
    background: '#fafafa',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.15s',
  },
  scoreBoxActive: {
    border: '1px solid #43a047',
    background: '#e8f5e9',
    color: '#2e7d32',
    fontWeight: 700,
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
