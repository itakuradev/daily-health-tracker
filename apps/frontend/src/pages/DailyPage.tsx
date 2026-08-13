import { useState } from 'react';
import { Dumbbell, HeartPulse, Utensils } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/ui/Card';
import { DatePickerField } from '../components/ui/DatePickerField';
import ConditionForm from '../components/ConditionForm';
import MealForm from '../components/MealForm';
import WorkoutForm from '../components/WorkoutForm';
import { getTodayRecordDate } from '../utils/recordDate';
import styles from './DailyPage.module.css';

export default function DailyPage() {
  const [date, setDate] = useState(getTodayRecordDate);

  return (
    <div className={styles.page}>
      <AppHeader nav="toHistory" />

      <main className={styles.main}>
        <div className={styles.dateBar}>
          <DatePickerField value={date} onChange={setDate} />
        </div>

        <div className={styles.grid}>
          <Card title="食事" icon={<Utensils size={20} />}>
            <MealForm date={date} />
          </Card>
          <Card title="体調" icon={<HeartPulse size={20} />}>
            <ConditionForm date={date} />
          </Card>
          <Card title="筋トレ" icon={<Dumbbell size={20} />}>
            <WorkoutForm date={date} />
          </Card>
        </div>
      </main>
    </div>
  );
}
