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
import { UpsertWorkoutDto } from './dto/upsert-workout.dto';
import { WorkoutsService } from './workouts.service';

@UseGuards(AuthGuard)
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  /** GET /api/workouts?date=YYYY-MM-DD */
  @Get()
  findByDate(
    @CurrentUserId() userId: number,
    @Query('date') date: string,
  ) {
    return this.workoutsService.findByDate(userId, date);
  }

  /** POST /api/workouts */
  @Post()
  @HttpCode(200)
  upsert(
    @CurrentUserId() userId: number,
    @Body() dto: UpsertWorkoutDto,
  ) {
    return this.workoutsService.upsert(userId, dto);
  }
}
