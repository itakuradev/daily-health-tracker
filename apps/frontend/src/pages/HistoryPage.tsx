import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useCallback, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { useHistory } from '../hooks/useHistory';
import type { DailyRecord } from '../types/api';

const SCORE_LABELS: Record<number, string> = {
  1: '😞 最悪',
  2: '😕 悪い',
  3: '😐 普通',
  4: '🙂 良い',
  5: '😄 最高',
};

export default function HistoryPage() {
  const today = new Date();
  const [activeDate, setActiveDate] = useState(today);          // カレンダーが表示している月
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // 削除確認ダイアログ用
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const year  = activeDate.getFullYear();
  const month = activeDate.getMonth() + 1;

  const { recordedDates, fetchDaily, deleteDaily } = useHistory(year, month);

  // カレンダーの月が切り替わったとき
  const handleActiveStartDateChange = ({ activeStartDate }: { activeStartDate: Date | null }) => {
    if (activeStartDate) setActiveDate(activeStartDate);
  };

  // 日付クリック
  const handleDateClick = useCallback(async (date: Date) => {
    const dateStr = toDateStr(date);
    setSelectedDate(dateStr);
    setDailyRecord(null);
    setDeleteError(null);
    setDetailLoading(true);
    try {
      const record = await fetchDaily(dateStr);
      setDailyRecord(record);
    } finally {
      setDetailLoading(false);
    }
  }, [fetchDaily]);

  // 削除実行
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDaily(deleteTarget);
      setDeleteTarget(null);
      // 削除後に詳細を再取得（全 null になる）
      const record = await fetchDaily(deleteTarget);
      setDailyRecord(record);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '削除に失敗しました');
      setDeleteTarget(null);
    }
  };

  const hasRecord = (date: Date) => recordedDates.has(toDateStr(date));
  const hasAnyRecord = dailyRecord &&
    (dailyRecord.meal || dailyRecord.condition || dailyRecord.workout);

  return (
    <div style={s.container}>
      <AppHeader nav="toRecord" />

      <main style={s.main}>
        <div style={s.layout}>
          {/* カレンダー */}
          <div style={s.calendarWrapper}>
            <Calendar
              locale="ja-JP"
              calendarType="gregory"
              activeStartDate={activeDate}
              onActiveStartDateChange={handleActiveStartDateChange}
              onClickDay={handleDateClick}
              tileContent={({ date, view }) =>
                view === 'month' && hasRecord(date)
                  ? <div style={s.dot} />
                  : null
              }
              tileClassName={({ date, view }) =>
                view === 'month' && selectedDate === toDateStr(date)
                  ? 'selected-tile'
                  : null
              }
            />
            <p style={s.calendarHint}>● のある日をクリックして詳細を表示</p>
          </div>

          {/* 詳細パネル */}
          <div style={s.detailPanel}>
            {!selectedDate && (
              <p style={s.emptyHint}>日付を選択してください</p>
            )}

            {selectedDate && detailLoading && (
              <p style={s.emptyHint}>読み込み中...</p>
            )}

            {selectedDate && !detailLoading && dailyRecord && (
              <>
                <div style={s.detailHeader}>
                  <h2 style={s.detailDate}>{selectedDate}</h2>
                  {hasAnyRecord && (
                    <button
                      style={s.deleteButton}
                      onClick={() => { setDeleteTarget(selectedDate); setDeleteError(null); }}
                    >
                      🗑️ 削除
                    </button>
                  )}
                </div>

                {deleteError && <p style={s.errorMsg}>❌ {deleteError}</p>}

                {!hasAnyRecord && (
                  <p style={s.emptyHint}>この日の記録はありません</p>
                )}

                {dailyRecord.meal && (
                  <section style={s.section}>
                    <h3 style={s.sectionTitle}>🍽️ 食事</h3>
                    <table style={s.table}>
                      <tbody>
                        {row('カロリー', dailyRecord.meal.calories, 'kcal')}
                        {row('タンパク質', dailyRecord.meal.protein, 'g')}
                        {row('脂質', dailyRecord.meal.fat, 'g')}
                        {row('炭水化物', dailyRecord.meal.carbs, 'g')}
                        {row('カルシウム', dailyRecord.meal.calcium, 'mg')}
                        {dailyRecord.meal.memo && (
                          <tr>
                            <td style={s.tdLabel}>メモ</td>
                            <td style={s.tdValue}>{dailyRecord.meal.memo}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </section>
                )}

                {dailyRecord.condition && (
                  <section style={s.section}>
                    <h3 style={s.sectionTitle}>💪 体調</h3>
                    <table style={s.table}>
                      <tbody>
                        {row('体重', dailyRecord.condition.weight, 'kg')}
                        {row('ウエスト', dailyRecord.condition.waist, 'cm')}
                        {row('腕周り', dailyRecord.condition.armCircumference, 'cm')}
                        {row('睡眠時間', dailyRecord.condition.sleepHours, 'h')}
                        {dailyRecord.condition.conditionScore != null && (
                          <tr>
                            <td style={s.tdLabel}>体調スコア</td>
                            <td style={s.tdValue}>
                              {SCORE_LABELS[dailyRecord.condition.conditionScore] ?? dailyRecord.condition.conditionScore}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </section>
                )}

                {dailyRecord.workout && (
                  <section style={s.section}>
                    <h3 style={s.sectionTitle}>🏋️ 筋トレ</h3>
                    {dailyRecord.workout.memo
                      ? <p style={s.workoutMemo}>{dailyRecord.workout.memo}</p>
                      : <p style={s.emptyHint}>メモなし</p>}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div style={s.overlay}>
          <div style={s.dialog}>
            <p style={s.dialogMsg}>
              <strong>{deleteTarget}</strong> の記録をすべて削除しますか？
            </p>
            <p style={s.dialogSub}>食事・体調・筋トレが一括削除されます。この操作は取り消せません。</p>
            <div style={s.dialogActions}>
              <button style={s.cancelButton} onClick={() => setDeleteTarget(null)}>
                キャンセル
              </button>
              <button style={s.confirmButton} onClick={() => void handleDeleteConfirm()}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function row(label: string, value: number | null | undefined, unit: string) {
  if (value == null) return null;
  return (
    <tr key={label}>
      <td style={s.tdLabel}>{label}</td>
      <td style={s.tdValue}>{value} {unit}</td>
    </tr>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#f5f5f5', fontFamily: 'sans-serif' },
  header: {
    background: '#2e7d32', color: '#fff', padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  backButton: {
    background: 'transparent', color: '#fff',
    border: '1px solid rgba(255,255,255,0.5)', borderRadius: 6,
    padding: '5px 12px', cursor: 'pointer', fontSize: 13,
  },
  headerTitle: { fontSize: 20, fontWeight: 700, margin: 0 },
  logoutButton: {
    background: 'transparent', color: '#fff',
    border: '1px solid rgba(255,255,255,0.5)', borderRadius: 6,
    padding: '6px 16px', cursor: 'pointer', fontSize: 13,
  },
  main: { maxWidth: 960, margin: '0 auto', padding: '24px 16px' },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 24,
    alignItems: 'start',
  },
  calendarWrapper: { display: 'flex', flexDirection: 'column', gap: 8 },
  calendarHint: { fontSize: 11, color: '#aaa', textAlign: 'center', margin: 0 },
  dot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#43a047', margin: '2px auto 0',
  },
  detailPanel: {
    background: '#fff', borderRadius: 12, padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minHeight: 200,
  },
  emptyHint: { color: '#bbb', fontSize: 13, fontStyle: 'italic' },
  detailHeader: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  detailDate: { fontSize: 18, fontWeight: 700, color: '#2e7d32', margin: 0 },
  deleteButton: {
    background: '#fff5f5', color: '#c62828',
    border: '1px solid #ef9a9a', borderRadius: 6,
    padding: '5px 14px', cursor: 'pointer', fontSize: 13,
  },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  tdLabel: { fontSize: 13, color: '#888', padding: '3px 0', width: 100 },
  tdValue: { fontSize: 13, color: '#333', padding: '3px 0' },
  workoutMemo: { fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.6 },
  errorMsg: { color: '#c62828', fontSize: 13, marginBottom: 8 },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: '#fff', borderRadius: 12, padding: '28px 32px',
    maxWidth: 360, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  dialogMsg: { fontSize: 15, color: '#333', marginBottom: 8 },
  dialogSub: { fontSize: 12, color: '#888', marginBottom: 24 },
  dialogActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelButton: {
    padding: '8px 20px', border: '1px solid #ddd', borderRadius: 6,
    background: '#fff', color: '#555', cursor: 'pointer', fontSize: 14,
  },
  confirmButton: {
    padding: '8px 20px', border: 'none', borderRadius: 6,
    background: '#c62828', color: '#fff', cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
  },
};
