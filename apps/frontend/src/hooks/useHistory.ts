import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import type { DailyRecord } from '../types/api';

export function useHistory(year: number, month: number) {
  /** 記録のある日付セット (YYYY-MM-DD) */
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set());
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const fetchMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const dates = await apiClient.get<string[]>(
        `/api/history/monthly?year=${year}&month=${month}`,
      );
      setRecordedDates(new Set(dates));
    } finally {
      setMonthlyLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void fetchMonthly();
  }, [fetchMonthly]);

  /** 指定日の詳細を取得 */
  const fetchDaily = useCallback(
    async (date: string): Promise<DailyRecord> => {
      return apiClient.get<DailyRecord>(`/api/history/daily?date=${date}`);
    },
    [],
  );

  /** 指定日の記録を一括削除し、月次を再取得する */
  const deleteDaily = useCallback(
    async (date: string): Promise<void> => {
      await apiClient.delete(`/api/history/daily?date=${date}`);
      await fetchMonthly();
    },
    [fetchMonthly],
  );

  return { recordedDates, monthlyLoading, fetchDaily, deleteDaily, refetchMonthly: fetchMonthly };
}
