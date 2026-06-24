import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * ローカル開発用の仮認証ガード。
 * X-User-Id ヘッダーを読み取り req.userId にセットする。
 * Cognito 導入時はこのファイルのみ JWT 検証ロジックに差し替える。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; userId: number }>();
    const raw = request.headers['x-user-id'];

    if (!raw) {
      throw new UnauthorizedException('X-User-Id header is required');
    }

    const userId = parseInt(raw, 10);
    if (isNaN(userId)) {
      throw new UnauthorizedException('X-User-Id must be a valid integer');
    }

    request.userId = userId;
    return true;
  }
}
