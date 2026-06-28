export class UpsertConditionDto {
  date: string;              // YYYY-MM-DD
  weight?: number;
  waist?: number;
  armCircumference?: number;
  sleepHours?: number;
  conditionScore?: number;   // 1〜5
}
