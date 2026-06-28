import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UpsertMealDto } from './dto/upsert-meal.dto';
import { MealsService } from './meals.service';

@ApiTags('meals')
@ApiSecurity('X-User-Id')
@ApiHeader({ name: 'X-User-Id', description: '開発用ユーザーID（例: 1）', required: true })
@UseGuards(AuthGuard)
@Controller('meals')
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Get()
  @ApiOperation({ summary: '食事記録を取得', description: '指定日の食事記録を返す。未登録なら null。' })
  @ApiQuery({ name: 'date', example: '2026-06-28', description: '取得したい日 (YYYY-MM-DD)' })
  @ApiOkResponse({ description: '食事記録またはnull' })
  findByDate(
    @CurrentUserId() userId: number,
    @Query('date') date: string,
  ) {
    return this.mealsService.findByDate(userId, date);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: '食事記録を保存 (upsert)', description: '未登録なら作成、登録済みなら更新。' })
  @ApiOkResponse({ description: '保存後の食事記録' })
  upsert(
    @CurrentUserId() userId: number,
    @Body() dto: UpsertMealDto,
  ) {
    return this.mealsService.upsert(userId, dto);
  }
}
