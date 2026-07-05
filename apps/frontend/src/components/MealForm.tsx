import { useEffect, useState } from 'react';
import ErrorBanner from './ErrorBanner';
import { useMeal } from '../hooks/useMeal';
import type { UpsertMealPayload } from '../types/api';

interface Props {
  date: string;
}

interface FormValues {
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  calcium: string;
  memo: string;
}

const EMPTY: FormValues = {
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  calcium: '',
  memo: '',
};

function recordToForm(record: { calories: number | null; protein: number | null; fat: number | null; carbs: number | null; calcium: number | null; memo: string | null } | null): FormValues {
  if (!record) return EMPTY;
  return {
    calories: record.calories != null ? String(record.calories) : '',
    protein: record.protein != null ? String(record.protein) : '',
    fat: record.fat != null ? String(record.fat) : '',
    carbs: record.carbs != null ? String(record.carbs) : '',
    calcium: record.calcium != null ? String(record.calcium) : '',
    memo: record.memo ?? '',
  };
}

export default function MealForm({ date }: Props) {
  const { record, loading, saveStatus, errorMessage, save } = useMeal(date);
  const [values, setValues] = useState<FormValues>(EMPTY);

  // 日付変更 or データ取得完了のたびにフォームを最新データで初期化
  useEffect(() => {
    setValues(recordToForm(record));
  }, [record]);

  const handleChange = (field: keyof FormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleReset = () => setValues(EMPTY);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpsertMealPayload = {
      date,
      calories: values.calories !== '' ? Number(values.calories) : undefined,
      protein: values.protein !== '' ? Number(values.protein) : undefined,
      fat: values.fat !== '' ? Number(values.fat) : undefined,
      carbs: values.carbs !== '' ? Number(values.carbs) : undefined,
      calcium: values.calcium !== '' ? Number(values.calcium) : undefined,
      memo: values.memo !== '' ? values.memo : undefined,
    };
    void save(payload);
  };

  if (loading) return <p style={s.hint}>読み込み中...</p>;

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.grid}>
        <Field label="カロリー" unit="kcal" value={values.calories} onChange={handleChange('calories')} />
        <Field label="タンパク質" unit="g" value={values.protein} onChange={handleChange('protein')} />
        <Field label="脂質" unit="g" value={values.fat} onChange={handleChange('fat')} />
        <Field label="炭水化物" unit="g" value={values.carbs} onChange={handleChange('carbs')} />
        <Field label="カルシウム" unit="mg" value={values.calcium} onChange={handleChange('calcium')} />
      </div>

      <div style={s.memoField}>
        <label style={s.label}>メモ</label>
        <textarea
          style={s.textarea}
          rows={3}
          placeholder="例）朝食：ご飯・味噌汁、昼食：定食"
          value={values.memo}
          onChange={handleChange('memo')}
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

      {saveStatus === 'saved' && (
        <p style={s.successMsg}>✅ 保存しました</p>
      )}
      <ErrorBanner message={saveStatus === 'error' ? errorMessage : null} />
    </form>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
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
  memoField: { display: 'flex', flexDirection: 'column', gap: 4 },
  textarea: {
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 13,
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
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
