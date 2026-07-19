import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from './auth.guard';
import { CurrentUserId } from './current-user.decorator';
import { MeResponseDto } from './dto/me-response.dto';

/**
 * 認証済みユーザー自身の情報を返す。
 *
 * 認証疎通の確認と、フロントエンドでの表示名参照に用いる。
 */
@ApiTags('auth')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: '認証済みユーザー情報を取得',
    description:
      'Access Token から解決した認証済みユーザー自身の情報を返す。userId は受け取らない。',
  })
  @ApiOkResponse({ type: MeResponseDto })
  async findMe(@CurrentUserId() userId: number): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    // AuthGuard が解決した直後に User が消えている場合のみ到達する。
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
