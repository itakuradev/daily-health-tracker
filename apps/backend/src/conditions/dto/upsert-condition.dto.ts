import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertConditionDto {
  @ApiProperty({ example: '2026-06-28', description: '記録日 (YYYY-MM-DD)' })
  date: string;

  @ApiPropertyOptional({ example: 70.5, description: '体重 (kg)' })
  weight?: number;

  @ApiPropertyOptional({ example: 80.0, description: 'ウエスト (cm)' })
  waist?: number;

  @ApiPropertyOptional({ example: 30.0, description: '腕周り (cm)' })
  armCircumference?: number;

  @ApiPropertyOptional({ example: 7.5, description: '睡眠時間 (時間)' })
  sleepHours?: number;

  @ApiPropertyOptional({ example: 4, description: '体調スコア (1〜5)' })
  conditionScore?: number;
}
