import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../utils/apiClient';
import type { UpsertWorkoutPayload, WorkoutRecord } from '../types/api';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useWorkout(date: string) {
  const [record, setRecord] = useState<WorkoutRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiClient.get<WorkoutRecord | null>(`/api/workouts?date=${date}`);
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

  const save = useCallback(async (payload: UpsertWorkoutPayload) => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const updated = await apiClient.post<WorkoutRecord>('/api/workouts', payload);
      setRecord(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
      setErrorMessage(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }, []);

  return { record, loading, saveStatus, errorMessage, save, refetch: fetch };
}
