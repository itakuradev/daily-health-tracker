import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMealDto } from './dto/upsert-meal.dto';

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * YYYY-MM-DD 文字列を PostgreSQL date 型として保存するための Date に変換する。
   * UTC 00:00:00 として扱うことでタイムゾーンによる日付ズレを防ぐ。
   */
  private toRecordDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  async findByDate(userId: number, date: string) {
    return this.prisma.meal.findUnique({
      where: {
        userId_recordDate: {
          userId,
          recordDate: this.toRecordDate(date),
        },
      },
    });
  }

  async upsert(userId: number, dto: UpsertMealDto) {
    const recordDate = this.toRecordDate(dto.date);

    const data = {
      calories: dto.calories ?? null,
      protein: dto.protein ?? null,
      fat: dto.fat ?? null,
      carbs: dto.carbs ?? null,
      calcium: dto.calcium ?? null,
      memo: dto.memo ?? null,
    };

    return this.prisma.meal.upsert({
      where: {
        userId_recordDate: { userId, recordDate },
      },
      create: { userId, recordDate, ...data },
      update: { ...data },
    });
  }
}
