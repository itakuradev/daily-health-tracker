import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * コントローラーの引数に @CurrentUserId() と書くと
 * AuthGuard がセットした req.userId を受け取れる。
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<{ userId: number }>();
    return request.userId;
  },
);
