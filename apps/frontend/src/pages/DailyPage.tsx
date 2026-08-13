import { useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import ConditionForm from '../components/ConditionForm';
import MealForm from '../components/MealForm';
import WorkoutForm from '../components/WorkoutForm';
import { getTodayRecordDate } from '../utils/recordDate';

export default function DailyPage() {
  const [date, setDate] = useState(getTodayRecordDate);

  const handleTodayClick = () => setDate(getTodayRecordDate());

  return (
    <div style={s.container}>
      <AppHeader nav="toHistory" />

      <main style={s.main}>
        {/* 日付バー */}
        <div style={s.dateBar}>
          <span style={s.dateLabel}>記録日</span>
          <input
            type="date"
            style={s.dateInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button style={s.todayButton} onClick={handleTodayClick}>
            今日
          </button>
        </div>

        <div style={s.grid}>
          {/* 食事カード */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>🍽️ 食事</h2>
            <MealForm date={date} />
          </section>

          {/* 体調カード */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>💪 体調</h2>
            <ConditionForm date={date} />
          </section>

          {/* 筋トレカード */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>🏋️ 筋トレ</h2>
            <WorkoutForm date={date} />
          </section>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5',
    fontFamily: 'sans-serif',
  },
  header: {
    background: '#2e7d32',
    color: '#fff',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
  },
  headerActions: { display: 'flex', gap: 8, alignItems: 'center' },
  historyButton: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  logoutButton: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 6,
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: 13,
  },
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '24px 16px',
  },
  dateBar: {
    background: '#fff',
    borderRadius: 8,
    padding: '10px 20px',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  dateLabel: {
    fontSize: 13,
    color: '#888',
    whiteSpace: 'nowrap',
  },
  dateInput: {
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 15,
    color: '#2e7d32',
    fontWeight: 700,
    outline: 'none',
  },
  todayButton: {
    background: '#e8f5e9',
    color: '#2e7d32',
    border: '1px solid #a5d6a7',
    borderRadius: 6,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  userId: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#aaa',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
    alignItems: 'start',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    color: '#333',
  },
};
