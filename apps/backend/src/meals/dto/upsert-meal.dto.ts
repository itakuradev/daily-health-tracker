import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertMealDto {
  @ApiProperty({ example: '2026-06-28', description: '記録日 (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 700, description: 'カロリー (kcal)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calories?: number;

  @ApiPropertyOptional({ example: 30, description: 'タンパク質 (g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  protein?: number;

  @ApiPropertyOptional({ example: 20, description: '脂質 (g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fat?: number;

  @ApiPropertyOptional({ example: 80, description: '炭水化物 (g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbs?: number;

  @ApiPropertyOptional({ example: 300, description: 'カルシウム (mg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calcium?: number;

  @ApiPropertyOptional({ example: '朝食：ご飯、味噌汁', description: 'メモ' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  memo?: string;
}
