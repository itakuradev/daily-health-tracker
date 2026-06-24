import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UpsertMealDto } from './dto/upsert-meal.dto';
import { MealsService } from './meals.service';

@UseGuards(AuthGuard)
@Controller('meals')
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  /**
   * GET /api/meals?date=YYYY-MM-DD
   * 指定日の食事記録を返す。未登録なら null。
   */
  @Get()
  findByDate(
    @CurrentUserId() userId: number,
    @Query('date') date: string,
  ) {
    return this.mealsService.findByDate(userId, date);
  }

  /**
   * POST /api/meals
   * 未登録なら作成、登録済みなら更新 (upsert)。
   */
  @Post()
  @HttpCode(200)
  upsert(
    @CurrentUserId() userId: number,
    @Body() dto: UpsertMealDto,
  ) {
    return this.mealsService.upsert(userId, dto);
  }
}
