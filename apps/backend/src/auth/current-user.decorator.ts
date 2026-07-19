import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * コントローラーの引数に @CurrentUserId() と書くと
 * AuthGuard が解決した User.id を受け取れる。
 *
 * 返すのは Cognito の sub ではなくアプリケーション DB の User.id である
 * （記録データは User.id に紐づくため。認証・認可設計書 10.1）。
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.userId;
  },
);
