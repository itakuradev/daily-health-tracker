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
import { UpsertWorkoutDto } from './dto/upsert-workout.dto';
import { WorkoutsService } from './workouts.service';

@ApiTags('workouts')
@ApiSecurity('X-User-Id')
@ApiHeader({
  name: 'X-User-Id',
  description: '開発用ユーザーID（例: 1）',
  required: true,
})
@UseGuards(AuthGuard)
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get()
  @ApiOperation({
    summary: '筋トレ記録を取得',
    description: '指定日の筋トレ記録を返す。未登録なら null。',
  })
  @ApiQuery({
    name: 'date',
    example: '2026-06-28',
    description: '取得したい日 (YYYY-MM-DD)',
  })
  @ApiOkResponse({ description: '筋トレ記録またはnull' })
  findByDate(@CurrentUserId() userId: number, @Query('date') date: string) {
    return this.workoutsService.findByDate(userId, date);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: '筋トレ記録を保存 (upsert)',
    description: '未登録なら作成、登録済みなら更新。',
  })
  @ApiOkResponse({ description: '保存後の筋トレ記録' })
  upsert(@CurrentUserId() userId: number, @Body() dto: UpsertWorkoutDto) {
    return this.workoutsService.upsert(userId, dto);
  }
}
