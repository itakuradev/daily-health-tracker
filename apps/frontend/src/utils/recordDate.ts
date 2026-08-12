/**
 * 「記録日」を返す。
 * JST 5:00 AM を日付の境界とし、JST 5:00 以前は前日扱い。
 *
 * 例) JST 2026-06-28 04:59 → "2026-06-27"
 *     JST 2026-06-28 05:00 → "2026-06-28"
 */
export function getTodayRecordDate(): string {
  const now = new Date();
  // UTC+9 に換算してから5時間引く (= UTC+4 相当)
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const boundary = new Date(jst);
  boundary.setUTCHours(5, 0, 0, 0);

  const target = jst < boundary
    ? new Date(jst.getTime() - 24 * 60 * 60 * 1000)
    : jst;

  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD 文字列を Date オブジェクトに変換 (JST 0時) */
export function parseRecordDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}

/**
 * Date をローカルの暦日として YYYY-MM-DD 文字列へ整形する。
 * react-calendar が返すローカル Date を記録日文字列へ戻す用途。
 */
export function formatRecordDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
