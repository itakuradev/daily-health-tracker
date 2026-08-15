import {
  Controller,
  Delete,
  Get,
  HttpCode,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { HistoryService } from './history.service';

@ApiTags('history')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  /**
   * GET /api/history/monthly?year=2026&month=7
   * 指定月に記録が存在する日付の配列を返す（カレンダー丸マーク用）。
   */
  @Get('monthly')
  @ApiOperation({
    summary: '月次記録日一覧',
    description:
      '指定月に何らかの記録（食事 / 体調 / 筋トレ）が存在する日付の配列を返す。',
  })
  @ApiQuery({ name: 'year', example: 2026, description: '年 (数値)' })
  @ApiQuery({ name: 'month', example: 7, description: '月 (1〜12)' })
  @ApiOkResponse({ description: '["2026-07-01", "2026-07-03", ...]' })
  getMonthly(
    @CurrentUserId() userId: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.historyService.getMonthlyDates(userId, year, month);
  }

  /**
   * GET /api/history/daily?date=2026-07-04
   * 指定日の食事・体調・筋トレをまとめて返す。
   */
  @Get('daily')
  @ApiOperation({
    summary: '日次記録取得',
    description:
      '指定日の食事・体調・筋トレを一括取得する。存在しないリソースは null。',
  })
  @ApiQuery({
    name: 'date',
    example: '2026-07-04',
    description: '取得したい日 (YYYY-MM-DD)',
  })
  @ApiOkResponse({ description: '{ date, meal, condition, workout }' })
  getDaily(@CurrentUserId() userId: number, @Query('date') date: string) {
    return this.historyService.getDailyRecord(userId, date);
  }

  /**
   * GET /api/history/weekly?date=2026-08-11
   * 選択日を含む週（日曜〜土曜）の7日分の記録を返す。
   */
  @Get('weekly')
  @ApiOperation({
    summary: '週次記録取得',
    description:
      '選択日を含む週（日曜〜土曜）の7日分の食事・体調・筋トレを返す。記録のない日は null。',
  })
  @ApiQuery({
    name: 'date',
    example: '2026-08-11',
    description: '週の基準日 (YYYY-MM-DD)',
  })
  @ApiOkResponse({
    description:
      '{ weekStart, weekEnd, days: [{ date, meal, condition, workout } × 7] }',
  })
  getWeekly(@CurrentUserId() userId: number, @Query('date') date: string) {
    return this.historyService.getWeeklyRecords(userId, date);
  }

  /**
   * DELETE /api/history/daily?date=2026-07-04
   * 指定日の食事・体調・筋トレをトランザクションで一括削除する。
   */
  @Delete('daily')
  @HttpCode(204)
  @ApiOperation({
    summary: '日次記録削除',
    description:
      '指定日の食事・体調・筋トレをトランザクションで一括削除する。存在しない場合も 204 を返す。',
  })
  @ApiQuery({
    name: 'date',
    example: '2026-07-04',
    description: '削除したい日 (YYYY-MM-DD)',
  })
  async deleteDaily(
    @CurrentUserId() userId: number,
    @Query('date') date: string,
  ): Promise<void> {
    await this.historyService.deleteDailyRecord(userId, date);
  }
}
