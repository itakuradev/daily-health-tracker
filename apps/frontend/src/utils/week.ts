/**
 * 週間グラフ・日別詳細の表示用ヘルパー（表示専用）。
 * 週範囲の算出はバックエンド（GET /api/history/weekly）が担う。
 */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** "2026-08-11" → "8/11(火)"（グラフのX軸ラベル） */
export function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEKDAYS[weekday]})`;
}

/** "2026-08-11" → "8月11日"（Tooltip・詳細見出し） */
export function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}月${d}日`;
}

/** 数値を桁区切りで整形（2100 → "2,100"、70.5 → "70.5"） */
export function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP');
}
