import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyRecord } from '../../types/api';
import { formatMonthDay, formatNumber, formatWeekday } from '../../utils/week';
import type { GraphMetric } from './graphMetrics';
import styles from './WeeklyChart.module.css';

/** トークン --color-accent と同値（SVG 属性では var() を使わないため定数化） */
const ACCENT = '#4a8c40';

interface WeeklyChartProps {
  days: DailyRecord[];
  metric: GraphMetric;
}

interface ChartDatum {
  date: string;
  label: string;
  value: number | null;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
  unit: string;
}

function ChartTooltip({ active, payload, unit }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload;
  if (datum.value == null) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{formatMonthDay(datum.date)}</div>
      <div className={styles.tooltipValue}>
        {formatNumber(datum.value)}
        {unit && <span className={styles.tooltipUnit}> {unit}</span>}
      </div>
    </div>
  );
}

/**
 * 週間折れ線グラフ（1項目のみ）。
 * 欠損（未記録）は null のままにして線を途切れさせる（0 に落とさない）。
 * 週全体にデータがなければ Empty State を表示する。
 */
export function WeeklyChart({ days, metric }: WeeklyChartProps) {
  const data: ChartDatum[] = days.map((d) => ({
    date: d.date,
    label: formatWeekday(d.date),
    value: metric.accessor(d),
  }));

  const hasAny = data.some((d) => d.value != null);

  if (!hasAny) {
    return <div className={styles.empty}>この週の記録はありません</div>;
  }

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e7e2" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#e3e7e2" />
          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#e3e7e2" width={48} />
          <Tooltip content={<ChartTooltip unit={metric.unit} />} />
          <Area
            type="linear"
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#weeklyFill)"
            connectNulls={false}
            dot={{ r: 3, fill: ACCENT }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
