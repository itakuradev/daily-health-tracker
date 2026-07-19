import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CognitoJwtVerifierService } from './cognito-jwt.verifier';
import { UserResolverService } from './user-resolver.service';

/** AuthGuard が解決済みの User.id を載せるリクエスト型 */
export interface AuthenticatedRequest extends Request {
  userId: number;
}

/**
 * Cognito Access Token を検証し、認証済み User を解決する Guard。
 *
 * 責務は「Authorization ヘッダーの取り出し」「Access Token の検証」
 * 「User 解決 Service の呼び出し」までに限定する。
 * DB アクセス・UserInfo 呼び出し・User 作成ロジックは持たない
 * （認証・認可設計書 9.4）。
 *
 * 検証に失敗した理由は外部へ返さず、一律 401 とする。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly verifier: CognitoJwtVerifierService,
    private readonly userResolver: UserResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException();
    }

    const verified = await this.verifier.verify(token);
    if (!verified) {
      throw new UnauthorizedException();
    }

    const user = await this.userResolver.resolve(verified.sub, token);
    request.userId = user.id;

    return true;
  }

  /** "Bearer <token>" から token 部分を取り出す。形式が不正なら null */
  private extractBearerToken(header: string | undefined): string | null {
    if (!header) return null;

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

    return token;
  }
}
