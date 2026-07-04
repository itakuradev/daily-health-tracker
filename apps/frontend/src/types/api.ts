/** 食事記録（API レスポンス） */
export interface MealRecord {
  id: number;
  userId: number;
  recordDate: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  calcium: number | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 食事記録の保存リクエスト */
export interface UpsertMealPayload {
  date: string;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  calcium?: number;
  memo?: string;
}

/** 体調記録（API レスポンス） */
export interface ConditionRecord {
  id: number;
  userId: number;
  recordDate: string;
  weight: number | null;
  waist: number | null;
  armCircumference: number | null;
  sleepHours: number | null;
  conditionScore: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 体調記録の保存リクエスト */
export interface UpsertConditionPayload {
  date: string;
  weight?: number;
  waist?: number;
  armCircumference?: number;
  sleepHours?: number;
  conditionScore?: number;
}

/** 筋トレ記録（API レスポンス） */
export interface WorkoutRecord {
  id: number;
  userId: number;
  recordDate: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 筋トレ記録の保存リクエスト */
export interface UpsertWorkoutPayload {
  date: string;
  memo?: string;
}
