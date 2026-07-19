import { ApiProperty } from '@nestjs/swagger';

/**
 * GET /api/me のレスポンス。
 *
 * cognitoSub は外部認証 ID であり、画面表示に不要なため返さない
 * （API設計書「認証済みユーザーの識別子を、画面表示目的で不用意に返さない」）。
 */
export class MeResponseDto {
  @ApiProperty({ description: 'アプリケーション内部のユーザーID', example: 1 })
  id!: number;

  @ApiProperty({
    description: 'メールアドレス',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: '表示名。UserInfo で取得できなかった場合は null',
    example: 'テスト太郎',
    nullable: true,
  })
  name!: string | null;
}
