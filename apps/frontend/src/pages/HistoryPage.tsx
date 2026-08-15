import { useEffect, useState } from 'react';
import { Dumbbell, HeartPulse, Trash2, Utensils } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DatePickerField } from '../components/ui/DatePickerField';
import { SelectField } from '../components/ui/SelectField';
import { WeeklyChart } from '../features/history/WeeklyChart';
import {
  DEFAULT_METRIC_KEY,
  GRAPH_METRICS,
  getMetric,
} from '../features/history/graphMetrics';
import { useHistory } from '../hooks/useHistory';
import { useWeeklyRecords } from '../hooks/useWeeklyRecords';
import { getTodayRecordDate } from '../utils/recordDate';
import { formatMonthDay, formatNumber } from '../utils/week';
import type {
  ConditionRecord,
  MealRecord,
  WorkoutRecord,
} from '../types/api';
import styles from './HistoryPage.module.css';

const METRIC_OPTIONS = GRAPH_METRICS.map((m) => ({ value: m.key, label: m.label }));

export default function HistoryPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayRecordDate);
  const [metricKey, setMetricKey] = useState(DEFAULT_METRIC_KEY);
  // 日付Picker のポップオーバー内カレンダーで記録日マーカーを出すための対象月
  const [markerYear, setMarkerYear] = useState(() =>
    Number(getTodayRecordDate().slice(0, 4)),
  );
  const [markerMonth, setMarkerMonth] = useState(() =>
    Number(getTodayRecordDate().slice(5, 7)),
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { recordedDates, deleteDaily } = useHistory(markerYear, markerMonth);
  const { week, loading, error, refetch } = useWeeklyRecords(selectedDate);

  // 削除確認ダイアログは Escape で閉じる
  useEffect(() => {
    if (!deleteOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteOpen]);

  const metric = getMetric(metricKey);
  const selectedDay = week?.days.find((d) => d.date === selectedDate) ?? null;
  const hasAny =
    !!selectedDay &&
    !!(selectedDay.meal || selectedDay.condition || selectedDay.workout);

  const handleDeleteConfirm = async () => {
    try {
      await deleteDaily(selectedDate);
      await refetch();
      setDeleteOpen(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '削除に失敗しました');
      setDeleteOpen(false);
    }
  };

  return (
    <div className={styles.page}>
      <AppHeader nav="toRecord" />

      <main className={styles.main}>
        <DatePickerField
          value={selectedDate}
          onChange={setSelectedDate}
          markedDates={recordedDates}
          onActiveMonthChange={(y, m) => {
            setMarkerYear(y);
            setMarkerMonth(m);
          }}
        />

        {/* グラフ */}
        <Card>
          <div className={styles.metricSelect}>
            <SelectField
              label="項目"
              options={METRIC_OPTIONS}
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
            />
          </div>

          {week && (
            <p className={styles.graphTitle}>
              {metric.label}の推移（{formatMonthDay(week.weekStart)} 〜{' '}
              {formatMonthDay(week.weekEnd)}）
            </p>
          )}
          {loading && <p className={styles.hint}>読み込み中...</p>}
          {error && <p className={styles.error}>{error}</p>}
          {week && !loading && <WeeklyChart days={week.days} metric={metric} />}
        </Card>

        {/* 日別詳細 */}
        <section className={styles.detail}>
          <div className={styles.detailHead}>
            <h2 className={styles.detailTitle}>
              {formatMonthDay(selectedDate)}の記録
            </h2>
            {hasAny && (
              <Button
                variant="secondary"
                icon={<Trash2 size={16} />}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                この日の記録を削除
              </Button>
            )}
          </div>

          {deleteError && <p className={styles.error}>{deleteError}</p>}
          {week && !loading && !hasAny && (
            <p className={styles.hint}>この日の記録はありません</p>
          )}

          {selectedDay && hasAny && (
            <div className={styles.detailGrid}>
              <Card title="食事" icon={<Utensils size={20} />}>
                <MealDetail meal={selectedDay.meal} />
              </Card>
              <Card title="体調" icon={<HeartPulse size={20} />}>
                <ConditionDetail condition={selectedDay.condition} />
              </Card>
              <Card title="筋トレ" icon={<Dumbbell size={20} />}>
                <WorkoutDetail workout={selectedDay.workout} />
              </Card>
            </div>
          )}
        </section>
      </main>

      {deleteOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.dialog}>
            <p className={styles.dialogMsg}>
              <strong>{formatMonthDay(selectedDate)}</strong>
              の記録をすべて削除しますか？
            </p>
            <p className={styles.dialogSub}>
              食事・体調・筋トレが一括削除されます。この操作は取り消せません。
            </p>
            <div className={styles.dialogActions}>
              <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
                キャンセル
              </Button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => void handleDeleteConfirm()}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  if (value == null) return null;
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>
        {formatNumber(value)}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

function MealDetail({ meal }: { meal: MealRecord | null }) {
  if (!meal) return <p className={styles.hint}>記録なし</p>;
  return (
    <div className={styles.rows}>
      <DetailRow label="カロリー" value={meal.calories} unit="kcal" />
      <DetailRow label="タンパク質" value={meal.protein} unit="g" />
      <DetailRow label="脂質" value={meal.fat} unit="g" />
      <DetailRow label="炭水化物" value={meal.carbs} unit="g" />
      <DetailRow label="カルシウム" value={meal.calcium} unit="mg" />
      {meal.memo && (
        <div className={styles.memoBlock}>
          <span className={styles.rowLabel}>メモ</span>
          <p className={styles.memoText}>{meal.memo}</p>
        </div>
      )}
    </div>
  );
}

function ConditionDetail({ condition }: { condition: ConditionRecord | null }) {
  if (!condition) return <p className={styles.hint}>記録なし</p>;
  return (
    <div className={styles.rows}>
      <DetailRow label="体重" value={condition.weight} unit="kg" />
      <DetailRow label="ウエスト" value={condition.waist} unit="cm" />
      <DetailRow label="腕周り" value={condition.armCircumference} unit="cm" />
      <DetailRow label="睡眠時間" value={condition.sleepHours} unit="h" />
      {/* 履歴詳細は数値のみ（ラベルなし） */}
      <DetailRow label="体調スコア" value={condition.conditionScore} />
    </div>
  );
}

function WorkoutDetail({ workout }: { workout: WorkoutRecord | null }) {
  if (!workout) return <p className={styles.hint}>記録なし</p>;
  return workout.memo ? (
    <p className={styles.memoText}>{workout.memo}</p>
  ) : (
    <p className={styles.hint}>メモなし</p>
  );
}
