import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toRecordDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
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
