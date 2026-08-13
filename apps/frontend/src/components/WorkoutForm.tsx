import { useEffect, useState } from 'react';
import { FormActions } from './ui/FormActions';
import { TextareaField } from './ui/TextareaField';
import { useWorkout } from '../hooks/useWorkout';
import type { UpsertWorkoutPayload } from '../types/api';
import styles from './forms.module.css';

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

  if (loading) return <p className={styles.hint}>読み込み中...</p>;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <TextareaField
        label="トレーニングメモ"
        rows={8}
        placeholder={'例）\nスクワット 3×10\nベンチプレス 3×8（60kg）\n腕立て 3×15'}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
      />

      <FormActions saveStatus={saveStatus} errorMessage={errorMessage} onReset={handleReset} />
    </form>
  );
}
