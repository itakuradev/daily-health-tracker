import { useEffect, useState } from 'react';
import { Field } from './ui/Field';
import { FormActions } from './ui/FormActions';
import { TextareaField } from './ui/TextareaField';
import { useMeal } from '../hooks/useMeal';
import type { UpsertMealPayload } from '../types/api';
import styles from './forms.module.css';

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

function recordToForm(
  record: {
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    calcium: number | null;
    memo: string | null;
  } | null,
): FormValues {
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

  const handleChange =
    (field: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  if (loading) return <p className={styles.hint}>読み込み中...</p>;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Field label="カロリー" unit="kcal" type="number" min={0} inputMode="decimal" placeholder="例）2000" value={values.calories} onChange={handleChange('calories')} />
      <Field label="タンパク質" unit="g" type="number" min={0} inputMode="decimal" placeholder="例）120" value={values.protein} onChange={handleChange('protein')} />
      <Field label="脂質" unit="g" type="number" min={0} inputMode="decimal" placeholder="例）60" value={values.fat} onChange={handleChange('fat')} />
      <Field label="炭水化物" unit="g" type="number" min={0} inputMode="decimal" placeholder="例）250" value={values.carbs} onChange={handleChange('carbs')} />
      <Field label="カルシウム" unit="mg" type="number" min={0} inputMode="decimal" placeholder="例）650" value={values.calcium} onChange={handleChange('calcium')} />

      <TextareaField
        label="メモ"
        rows={3}
        placeholder="例）朝食：ご飯・味噌汁、昼食：定食"
        value={values.memo}
        onChange={handleChange('memo')}
      />

      <FormActions saveStatus={saveStatus} errorMessage={errorMessage} onReset={handleReset} />
    </form>
  );
}
