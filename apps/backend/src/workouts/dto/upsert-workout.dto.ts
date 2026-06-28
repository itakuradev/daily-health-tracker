import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertWorkoutDto {
  @ApiProperty({ example: '2026-06-28', description: '記録日 (YYYY-MM-DD)' })
  date: string;

  @ApiPropertyOptional({ example: 'スクワット 3×10、腕立て 3×15', description: 'トレーニングメモ' })
  memo?: string;
}
