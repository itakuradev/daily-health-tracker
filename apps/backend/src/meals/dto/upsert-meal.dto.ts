import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertMealDto {
  @ApiProperty({ example: '2026-06-28', description: '記録日 (YYYY-MM-DD)' })
  date: string;

  @ApiPropertyOptional({ example: 700, description: 'カロリー (kcal)' })
  calories?: number;

  @ApiPropertyOptional({ example: 30, description: 'タンパク質 (g)' })
  protein?: number;

  @ApiPropertyOptional({ example: 20, description: '脂質 (g)' })
  fat?: number;

  @ApiPropertyOptional({ example: 80, description: '炭水化物 (g)' })
  carbs?: number;

  @ApiPropertyOptional({ example: 300, description: 'カルシウム (mg)' })
  calcium?: number;

  @ApiPropertyOptional({ example: '朝食：ご飯、味噌汁', description: 'メモ' })
  memo?: string;
}
