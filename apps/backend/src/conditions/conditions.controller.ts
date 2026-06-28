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
import { UpsertConditionDto } from './dto/upsert-condition.dto';
import { ConditionsService } from './conditions.service';

@UseGuards(AuthGuard)
@Controller('conditions')
export class ConditionsController {
  constructor(private readonly conditionsService: ConditionsService) {}

  /** GET /api/conditions?date=YYYY-MM-DD */
  @Get()
  findByDate(
    @CurrentUserId() userId: number,
    @Query('date') date: string,
  ) {
    return this.conditionsService.findByDate(userId, date);
  }

  /** POST /api/conditions */
  @Post()
  @HttpCode(200)
  upsert(
    @CurrentUserId() userId: number,
    @Body() dto: UpsertConditionDto,
  ) {
    return this.conditionsService.upsert(userId, dto);
  }
}
