import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { HistoryService } from './history.service';

const USER_ID = 1;

/** recordDate（UTC 0時）を持つ最小レコード */
function rec(dateStr: string, extra: Record<string, unknown> = {}) {
  return { recordDate: new Date(`${dateStr}T00:00:00.000Z`), ...extra };
}

describe('HistoryService.getWeeklyRecords', () => {
  let prisma: {
    meal: { findMany: jest.Mock };
    condition: { findMany: jest.Mock };
    workout: { findMany: jest.Mock };
  };
  let service: HistoryService;

  beforeEach(() => {
    prisma = {
      meal: { findMany: jest.fn().mockResolvedValue([]) },
      condition: { findMany: jest.fn().mockResolvedValue([]) },
      workout: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new HistoryService(prisma as unknown as PrismaService);
  });

  it('火曜(2026-08-11)を選ぶと 日曜(08-09)〜土曜(08-15) の7日を返す', async () => {
    const res = await service.getWeeklyRecords(USER_ID, '2026-08-11');

    expect(res.weekStart).toBe('2026-08-09');
    expect(res.weekEnd).toBe('2026-08-15');
    expect(res.days).toHaveLength(7);
    expect(res.days.map((d) => d.date)).toEqual([
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
    ]);
  });

  it('日曜(08-09)を選んでも同じ週になる', async () => {
    const res = await service.getWeeklyRecords(USER_ID, '2026-08-09');
    expect(res.weekStart).toBe('2026-08-09');
    expect(res.weekEnd).toBe('2026-08-15');
  });

  it('土曜(08-15)を選んでも同じ週になる', async () => {
    const res = await service.getWeeklyRecords(USER_ID, '2026-08-15');
    expect(res.weekStart).toBe('2026-08-09');
    expect(res.weekEnd).toBe('2026-08-15');
  });

  it('週範囲 [weekStart, weekStart+7) で各テーブルを検索する', async () => {
    await service.getWeeklyRecords(USER_ID, '2026-08-11');

    const expectedWhere = {
      where: {
        userId: USER_ID,
        recordDate: {
          gte: new Date('2026-08-09T00:00:00.000Z'),
          lt: new Date('2026-08-16T00:00:00.000Z'),
        },
      },
    };
    expect(prisma.meal.findMany).toHaveBeenCalledWith(expectedWhere);
    expect(prisma.condition.findMany).toHaveBeenCalledWith(expectedWhere);
    expect(prisma.workout.findMany).toHaveBeenCalledWith(expectedWhere);
  });

  it('記録のある日はレコード、ない日は null を返す', async () => {
    prisma.meal.findMany.mockResolvedValue([
      rec('2026-08-11', { id: 10, calories: 2100 }),
    ]);
    prisma.workout.findMany.mockResolvedValue([
      rec('2026-08-13', { id: 20, memo: 'スクワット' }),
    ]);

    const res = await service.getWeeklyRecords(USER_ID, '2026-08-11');

    const tue = res.days.find((d) => d.date === '2026-08-11')!;
    expect(tue.meal).toMatchObject({ id: 10, calories: 2100 });
    expect(tue.condition).toBeNull();
    expect(tue.workout).toBeNull();

    const thu = res.days.find((d) => d.date === '2026-08-13')!;
    expect(thu.workout).toMatchObject({ id: 20, memo: 'スクワット' });
    expect(thu.meal).toBeNull();

    const wed = res.days.find((d) => d.date === '2026-08-12')!;
    expect(wed.meal).toBeNull();
    expect(wed.condition).toBeNull();
    expect(wed.workout).toBeNull();
  });

  it.each(['2026/08/11', '20260811', 'not-a-date', '2026-13-40'])(
    '不正な date (%s) は 400 とする',
    async (bad) => {
      await expect(service.getWeeklyRecords(USER_ID, bad)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.meal.findMany).not.toHaveBeenCalled();
    },
  );
});
