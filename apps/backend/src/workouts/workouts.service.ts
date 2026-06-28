import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertWorkoutDto } from './dto/upsert-workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  private toRecordDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  async findByDate(userId: number, date: string) {
    return this.prisma.workout.findUnique({
      where: {
        userId_recordDate: {
          userId,
          recordDate: this.toRecordDate(date),
        },
      },
    });
  }

  async upsert(userId: number, dto: UpsertWorkoutDto) {
    const recordDate = this.toRecordDate(dto.date);

    const data = {
      memo: dto.memo ?? null,
    };

    return this.prisma.workout.upsert({
      where: {
        userId_recordDate: { userId, recordDate },
      },
      create: { userId, recordDate, ...data },
      update: { ...data },
    });
  }
}
