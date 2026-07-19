import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertWorkoutDto {
  @ApiProperty({ example: '2026-06-28', description: '記録日 (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    example: 'スクワット 3×10、腕立て 3×15',
    description: 'トレーニングメモ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  memo?: string;
}
