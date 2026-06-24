import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MealsModule } from './meals/meals.module';

@Module({
  imports: [PrismaModule, MealsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
