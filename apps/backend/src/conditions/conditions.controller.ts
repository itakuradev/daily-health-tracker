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
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UpsertConditionDto } from './dto/upsert-condition.dto';
import { ConditionsService } from './conditions.service';

@ApiTags('conditions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('conditions')
export class ConditionsController {
  constructor(private readonly conditionsService: ConditionsService) {}

  @Get()
  @ApiOperation({
    summary: '体調記録を取得',
    description: '指定日の体調記録を返す。未登録なら null。',
  })
  @ApiQuery({
    name: 'date',
    example: '2026-06-28',
    description: '取得したい日 (YYYY-MM-DD)',
  })
  @ApiOkResponse({ description: '体調記録またはnull' })
  findByDate(@CurrentUserId() userId: number, @Query('date') date: string) {
    return this.conditionsService.findByDate(userId, date);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: '体調記録を保存 (upsert)',
    description: '未登録なら作成、登録済みなら更新。',
  })
  @ApiOkResponse({ description: '保存後の体調記録' })
  upsert(@CurrentUserId() userId: number, @Body() dto: UpsertConditionDto) {
    return this.conditionsService.upsert(userId, dto);
  }
}
