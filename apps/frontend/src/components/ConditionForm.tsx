import { useEffect, useState } from 'react';
import { Field } from './ui/Field';
import { FormActions } from './ui/FormActions';
import { ScoreSelector } from './ScoreSelector';
import { useCondition } from '../hooks/useCondition';
import type { UpsertConditionPayload } from '../types/api';
import styles from './forms.module.css';

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

  if (loading) return <p className={styles.hint}>読み込み中...</p>;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Field label="体重" unit="kg" type="number" min={0} step="0.1" inputMode="decimal" placeholder="例）70.5" value={values.weight} onChange={handleChange('weight')} />
      <Field label="ウエスト" unit="cm" type="number" min={0} step="0.1" inputMode="decimal" placeholder="例）82.0" value={values.waist} onChange={handleChange('waist')} />
      <Field label="腕周り" unit="cm" type="number" min={0} step="0.1" inputMode="decimal" placeholder="例）30.0" value={values.armCircumference} onChange={handleChange('armCircumference')} />
      <Field label="睡眠時間" unit="h" type="number" min={0} step="0.5" inputMode="decimal" placeholder="例）7.5" value={values.sleepHours} onChange={handleChange('sleepHours')} />

      <ScoreSelector
        value={values.conditionScore !== '' ? Number(values.conditionScore) : null}
        onChange={(n) =>
          setValues((prev) => ({ ...prev, conditionScore: String(n) }))
        }
      />

      <FormActions saveStatus={saveStatus} errorMessage={errorMessage} onReset={handleReset} />
    </form>
  );
}
