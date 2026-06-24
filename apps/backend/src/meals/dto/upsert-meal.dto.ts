export class UpsertMealDto {
  date: string;        // YYYY-MM-DD
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  calcium?: number;
  memo?: string;
}
