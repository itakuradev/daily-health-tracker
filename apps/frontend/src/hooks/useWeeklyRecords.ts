import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import type { WeeklyRecord } from '../types/api';

/**
 * 選択日を含む週（日曜〜土曜）の7日分を取得する（GET /api/history/weekly を1回）。
 * 週データには全項目が含まれるため、グラフ項目の切り替えでは再取得しない。
 */
export function useWeeklyRecords(date: string) {
  const [week, setWeek] = useState<WeeklyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<WeeklyRecord>(
        `/api/history/weekly?date=${date}`,
      );
      setWeek(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void fetchWeek();
  }, [fetchWeek]);

  return { week, loading, error, refetch: fetchWeek };
}
