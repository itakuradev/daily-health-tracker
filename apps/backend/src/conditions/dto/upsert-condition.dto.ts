import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpsertConditionDto {
  @ApiProperty({ example: '2026-06-28', description: '記録日 (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 70.5, description: '体重 (kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ example: 80.0, description: 'ウエスト (cm)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  waist?: number;

  @ApiPropertyOptional({ example: 30.0, description: '腕周り (cm)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  armCircumference?: number;

  @ApiPropertyOptional({ example: 7.5, description: '睡眠時間 (時間)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  sleepHours?: number;

  @ApiPropertyOptional({ example: 4, description: '体調スコア (1〜5)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  conditionScore?: number;
}
