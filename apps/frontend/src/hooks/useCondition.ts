import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { ConditionRecord, UpsertConditionPayload } from '../types/api';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useCondition(date: string) {
  const { api } = useAuth();

  const [record, setRecord] = useState<ConditionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.get<ConditionRecord | null>(`/api/conditions?date=${date}`);
      setRecord(data);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [api, date]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const save = useCallback(
    async (payload: UpsertConditionPayload) => {
      if (!api) return;
      setSaveStatus('saving');
      setErrorMessage(null);
      try {
        const updated = await api.post<ConditionRecord>('/api/conditions', payload);
        setRecord(updated);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e) {
        setSaveStatus('error');
        setErrorMessage(e instanceof Error ? e.message : '保存に失敗しました');
      }
    },
    [api],
  );

  return { record, loading, saveStatus, errorMessage, save, refetch: fetch };
}
