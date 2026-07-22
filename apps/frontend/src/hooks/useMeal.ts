import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import type { MealRecord, UpsertMealPayload } from '../types/api';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useMeal(date: string) {
  const [record, setRecord] = useState<MealRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiClient.get<MealRecord | null>(`/api/meals?date=${date}`);
      setRecord(data);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const save = useCallback(async (payload: UpsertMealPayload) => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const updated = await apiClient.post<MealRecord>('/api/meals', payload);
      setRecord(updated);
      setSaveStatus('saved');
      // 3秒後に idle に戻す
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
      setErrorMessage(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }, []);

  return { record, loading, saveStatus, errorMessage, save, refetch: fetch };
}
