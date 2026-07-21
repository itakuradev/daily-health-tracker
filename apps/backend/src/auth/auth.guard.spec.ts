import {
  ExecutionContext,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';
import type { CognitoJwtVerifierService } from './cognito-jwt.verifier';
import type { UserResolverService } from './user-resolver.service';

const SUB = 'cognito-sub-001';
const TOKEN = 'valid.access.token';

/** Authorization ヘッダーを持つ ExecutionContext を組み立てる */
function contextWith(authorization?: string): {
  context: ExecutionContext;
  request: Partial<AuthenticatedRequest>;
} {
  const request: Partial<AuthenticatedRequest> = {
    headers: authorization ? { authorization } : {},
  };

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('AuthGuard', () => {
  let verifier: { verify: jest.Mock };
  let userResolver: { resolve: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    verifier = { verify: jest.fn() };
    userResolver = { resolve: jest.fn() };
    guard = new AuthGuard(
      verifier as unknown as CognitoJwtVerifierService,
      userResolver as unknown as UserResolverService,
    );
  });

  describe('認証成功', () => {
    it('検証済み sub から解決した User.id を request へ設定する', async () => {
      verifier.verify.mockResolvedValue({ sub: SUB });
      userResolver.resolve.mockResolvedValue({ id: 42 });
      const { context, request } = contextWith(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(verifier.verify).toHaveBeenCalledWith(TOKEN);
      expect(userResolver.resolve).toHaveBeenCalledWith(SUB, TOKEN);
      expect(request.userId).toBe(42);
    });

    it('Bearer スキームの大文字小文字を区別しない', async () => {
      verifier.verify.mockResolvedValue({ sub: SUB });
      userResolver.resolve.mockResolvedValue({ id: 42 });
      const { context } = contextWith(`bearer ${TOKEN}`);

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  describe('認証失敗', () => {
    it.each([
      ['Authorization ヘッダーがない', undefined],
      ['スキームがない', TOKEN],
      ['Bearer 以外のスキーム', `Basic ${TOKEN}`],
      ['token 部分がない', 'Bearer'],
      ['token が空', 'Bearer '],
    ])('%s 場合は 401 とする', async (_name, authorization) => {
      const { context } = contextWith(authorization);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(verifier.verify).not.toHaveBeenCalled();
    });

    it('token 検証に失敗した場合は 401 とし User 解決を行わない', async () => {
      verifier.verify.mockResolvedValue(null);
      const { context } = contextWith(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userResolver.resolve).not.toHaveBeenCalled();
    });

    it('401 のレスポンスに検証失敗の詳細を含めない', async () => {
      verifier.verify.mockResolvedValue(null);
      const { context } = contextWith(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(),
      );
    });
  });

  describe('外部障害・内部エラーを 401 へ変換しない', () => {
    it('verify() が 503 を送出した場合はそのまま 503 とする（401 化しない）', async () => {
      verifier.verify.mockRejectedValue(new ServiceUnavailableException());
      const { context } = contextWith(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      // 検証で止まり、User 解決には進まない
      expect(userResolver.resolve).not.toHaveBeenCalled();
    });

    it('verify() が予期しない例外を送出した場合は握りつぶさず伝播する（500）', async () => {
      const unexpected = new Error('unexpected boom');
      verifier.verify.mockRejectedValue(unexpected);
      const { context } = contextWith(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(context)).rejects.toBe(unexpected);
      expect(userResolver.resolve).not.toHaveBeenCalled();
    });

    it('User 解決 Service が送出した 503 を 401 へ変換しない', async () => {
      verifier.verify.mockResolvedValue({ sub: SUB });
      userResolver.resolve.mockRejectedValue(new ServiceUnavailableException());
      const { context } = contextWith(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('InternalServerErrorException も 401 へ変換しない', async () => {
      verifier.verify.mockRejectedValue(new InternalServerErrorException());
      const { context } = contextWith(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  it('X-User-Id ヘッダーでは認証できない（開発用ヘッダーの撤去）', async () => {
    const request: Partial<AuthenticatedRequest> = {
      headers: { 'x-user-id': '1' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(request.userId).toBeUndefined();
  });
});
