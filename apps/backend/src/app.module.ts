import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MealsModule } from './meals/meals.module';
import { ConditionsModule } from './conditions/conditions.module';
import { WorkoutsModule } from './workouts/workouts.module';

@Module({
  imports: [PrismaModule, MealsModule, ConditionsModule, WorkoutsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
