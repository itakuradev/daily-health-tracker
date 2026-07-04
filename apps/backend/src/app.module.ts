import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConditionsModule } from './conditions/conditions.module';
import { HistoryModule } from './history/history.module';
import { MealsModule } from './meals/meals.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkoutsModule } from './workouts/workouts.module';

@Module({
  imports: [PrismaModule, MealsModule, ConditionsModule, WorkoutsModule, HistoryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
