import type { DailyRecord } from '../../types/api';

/**
 * グラフ対象の10項目を一元管理する。
 * キー・表示名・単位・値のアクセサをここだけで定義し、
 * 共通グラフコンポーネント／詳細表示から参照する（項目ごとの個別実装をしない）。
 */
export interface GraphMetric {
  key: string;
  label: string;
  /** 単位。単位なしは空文字 */
  unit: string;
  /** 日次レコードから数値を取り出す。未記録は null */
  accessor: (day: DailyRecord) => number | null;
}

export const GRAPH_METRICS: GraphMetric[] = [
  { key: 'calories', label: 'カロリー', unit: 'kcal', accessor: (d) => d.meal?.calories ?? null },
  { key: 'protein', label: 'タンパク質', unit: 'g', accessor: (d) => d.meal?.protein ?? null },
  { key: 'fat', label: '脂質', unit: 'g', accessor: (d) => d.meal?.fat ?? null },
  { key: 'carbs', label: '炭水化物', unit: 'g', accessor: (d) => d.meal?.carbs ?? null },
  { key: 'calcium', label: 'カルシウム', unit: 'mg', accessor: (d) => d.meal?.calcium ?? null },
  { key: 'weight', label: '体重', unit: 'kg', accessor: (d) => d.condition?.weight ?? null },
  { key: 'waist', label: 'ウエスト', unit: 'cm', accessor: (d) => d.condition?.waist ?? null },
  { key: 'armCircumference', label: '腕周り', unit: 'cm', accessor: (d) => d.condition?.armCircumference ?? null },
  { key: 'sleepHours', label: '睡眠時間', unit: 'h', accessor: (d) => d.condition?.sleepHours ?? null },
  { key: 'conditionScore', label: '体調', unit: '', accessor: (d) => d.condition?.conditionScore ?? null },
];

export const DEFAULT_METRIC_KEY = 'calories';

export function getMetric(key: string): GraphMetric {
  return GRAPH_METRICS.find((m) => m.key === key) ?? GRAPH_METRICS[0];
}
