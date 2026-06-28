import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertConditionDto } from './dto/upsert-condition.dto';

@Injectable()
export class ConditionsService {
  constructor(private readonly prisma: PrismaService) {}

  private toRecordDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  async findByDate(userId: number, date: string) {
    return this.prisma.condition.findUnique({
      where: {
        userId_recordDate: {
          userId,
          recordDate: this.toRecordDate(date),
        },
      },
    });
  }

  async upsert(userId: number, dto: UpsertConditionDto) {
    const recordDate = this.toRecordDate(dto.date);

    const data = {
      weight:           dto.weight           ?? null,
      waist:            dto.waist            ?? null,
      armCircumference: dto.armCircumference ?? null,
      sleepHours:       dto.sleepHours       ?? null,
      conditionScore:   dto.conditionScore   ?? null,
    };

    return this.prisma.condition.upsert({
      where: {
        userId_recordDate: { userId, recordDate },
      },
      create: { userId, recordDate, ...data },
      update: { ...data },
    });
  }
}
