import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 1 日 86,400,000 ミリ秒 */
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toRecordDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  /** Date（UTC 0時保存）を YYYY-MM-DD 文字列へ */
  private toDateStr(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /** YYYY-MM-DD を検証し UTC 0時の Date にする。不正なら 400。 */
  private parseValidDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(
        'date は YYYY-MM-DD 形式で指定してください。',
      );
    }
    const d = new Date(dateStr + 'T00:00:00.000Z');
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('date が不正です。');
    }
    return d;
  }

  /**
   * 指定月に記録が存在する日付の配列を返す。
   * カレンダーの丸マーク表示に使用する。
   * 返り値例: ["2026-07-01", "2026-07-03", "2026-07-04"]
   */
  async getMonthlyDates(
    userId: number,
    year: number,
    month: number,
  ): Promise<string[]> {
    // 月の開始・終了を UTC で算出
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1)); // 翌月1日（exclusive）

    const [meals, conditions, workouts] = await Promise.all([
      this.prisma.meal.findMany({
        where: { userId, recordDate: { gte: from, lt: to } },
        select: { recordDate: true },
      }),
      this.prisma.condition.findMany({
        where: { userId, recordDate: { gte: from, lt: to } },
        select: { recordDate: true },
      }),
      this.prisma.workout.findMany({
        where: { userId, recordDate: { gte: from, lt: to } },
        select: { recordDate: true },
      }),
    ]);

    // 全テーブルの日付を集約し、重複を除いてソートして返す
    const dateSet = new Set<string>();
    for (const r of [...meals, ...conditions, ...workouts]) {
      dateSet.add(r.recordDate.toISOString().slice(0, 10));
    }

    return [...dateSet].sort();
  }

  /**
   * 指定日の食事・体調・筋トレをまとめて返す。
   * 存在しないリソースは null。
   */
  async getDailyRecord(userId: number, date: string) {
    const recordDate = this.toRecordDate(date);

    const [meal, condition, workout] = await Promise.all([
      this.prisma.meal.findUnique({
        where: { userId_recordDate: { userId, recordDate } },
      }),
      this.prisma.condition.findUnique({
        where: { userId_recordDate: { userId, recordDate } },
      }),
      this.prisma.workout.findUnique({
        where: { userId_recordDate: { userId, recordDate } },
      }),
    ]);

    return { date, meal, condition, workout };
  }

  /**
   * 選択日を含む週（日曜〜土曜）の7日分の記録をまとめて返す。
   *
   * 週範囲の算出はバックエンドに集約する（フロントは date を渡すだけ）。
   * 常に7日分を返し、記録のない日は null。グラフと日別詳細の両方をこの1レスポンスで賄う。
   */
  async getWeeklyRecords(userId: number, date: string) {
    const base = this.parseValidDate(date);

    // 日曜起点。getUTCDay(): 0=日曜 … 6=土曜。
    const weekStartMs = base.getTime() - base.getUTCDay() * DAY_MS;
    const weekStart = new Date(weekStartMs);
    const weekEndExclusive = new Date(weekStartMs + 7 * DAY_MS);

    const [meals, conditions, workouts] = await Promise.all([
      this.prisma.meal.findMany({
        where: { userId, recordDate: { gte: weekStart, lt: weekEndExclusive } },
      }),
      this.prisma.condition.findMany({
        where: { userId, recordDate: { gte: weekStart, lt: weekEndExclusive } },
      }),
      this.prisma.workout.findMany({
        where: { userId, recordDate: { gte: weekStart, lt: weekEndExclusive } },
      }),
    ]);

    const mealByDate = new Map(
      meals.map((m) => [this.toDateStr(m.recordDate), m]),
    );
    const conditionByDate = new Map(
      conditions.map((c) => [this.toDateStr(c.recordDate), c]),
    );
    const workoutByDate = new Map(
      workouts.map((w) => [this.toDateStr(w.recordDate), w]),
    );

    const days = Array.from({ length: 7 }, (_, i) => {
      const dstr = this.toDateStr(new Date(weekStartMs + i * DAY_MS));
      return {
        date: dstr,
        meal: mealByDate.get(dstr) ?? null,
        condition: conditionByDate.get(dstr) ?? null,
        workout: workoutByDate.get(dstr) ?? null,
      };
    });

    return {
      weekStart: this.toDateStr(weekStart),
      weekEnd: this.toDateStr(new Date(weekStartMs + 6 * DAY_MS)),
      days,
    };
  }

  /**
   * 指定日の食事・体調・筋トレをトランザクションで一括削除する。
   * 存在しない場合は deleteMany で 0件削除（エラーにしない）。
   */
  async deleteDailyRecord(userId: number, date: string): Promise<void> {
    const recordDate = this.toRecordDate(date);

    await this.prisma.$transaction([
      this.prisma.meal.deleteMany({
        where: { userId, recordDate },
      }),
      this.prisma.condition.deleteMany({
        where: { userId, recordDate },
      }),
      this.prisma.workout.deleteMany({
        where: { userId, recordDate },
      }),
    ]);
  }
}
