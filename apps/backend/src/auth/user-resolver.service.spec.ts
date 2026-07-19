import { UnauthorizedException } from '@nestjs/common';
import { Prisma, type User } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthConfig } from './auth.config';
import { UserResolverService } from './user-resolver.service';

const config: AuthConfig = {
  region: 'ap-northeast-1',
  userPoolId: 'ap-northeast-1_example',
  clientId: 'example-client-id',
  issuer:
    'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_example',
  userInfoUrl:
    'https://example.auth.ap-northeast-1.amazoncognito.com/oauth2/userInfo',
};

const SUB = 'cognito-sub-001';
const ACCESS_TOKEN = 'dummy-access-token';

const existingUser: User = {
  id: 1,
  email: 'user@example.com',
  name: 'テスト太郎',
  cognitoSub: SUB,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function uniqueViolation(
  target: string[],
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

/** fetch のモック。UserInfo のレスポンスを差し替える */
function mockUserInfo(body: unknown, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('UserResolverService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let service: UserResolverService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
    };
    service = new UserResolverService(
      prisma as unknown as PrismaService,
      config,
    );
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('既存 User の解決', () => {
    it('cognitoSub で見つかった User を返す', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.resolve(SUB, ACCESS_TOKEN);

      expect(result).toBe(existingUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { cognitoSub: SUB },
      });
    });

    it('既存 User がいる場合は UserInfo を呼ばない', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);
      global.fetch = jest.fn();

      await service.resolve(SUB, ACCESS_TOKEN);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('初回 User 作成', () => {
    it('UserInfo から email / name を取得して User を作成する', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(existingUser);
      mockUserInfo({ sub: SUB, email: 'user@example.com', name: 'テスト太郎' });

      const result = await service.resolve(SUB, ACCESS_TOKEN);

      expect(result).toBe(existingUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          cognitoSub: SUB,
          email: 'user@example.com',
          name: 'テスト太郎',
        },
      });
    });

    it('UserInfo に Access Token を Bearer で付与する', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(existingUser);
      mockUserInfo({ email: 'user@example.com' });

      await service.resolve(SUB, ACCESS_TOKEN);

      expect(global.fetch).toHaveBeenCalledWith(
        config.userInfoUrl,
        expect.objectContaining({
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        }),
      );
    });

    it('name が取得できない場合は null で作成する', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...existingUser, name: null });
      mockUserInfo({ sub: SUB, email: 'user@example.com' });

      await service.resolve(SUB, ACCESS_TOKEN);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { cognitoSub: SUB, email: 'user@example.com', name: null },
      });
    });

    it('email が取得できない場合は User を作らず 401 とする', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockUserInfo({ sub: SUB, name: 'テスト太郎' });

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('UserInfo 取得失敗', () => {
    it('UserInfo が異常ステータスを返した場合は 401 とする', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockUserInfo({}, false, 401);

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('UserInfo への接続に失敗した場合は 401 とする', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('UserInfo 失敗の詳細を例外メッセージへ含めない', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:443'));

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.not.toThrow(
        /ECONNREFUSED/,
      );
    });
  });

  describe('初回作成の冪等性', () => {
    it('cognitoSub の unique 制約違反時は既存 User を再取得して返す', async () => {
      // 1 回目: 未存在 → 2 回目（衝突後の再取得）: 並行リクエストが作成済み
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser);
      prisma.user.create.mockRejectedValue(uniqueViolation(['cognitoSub']));
      mockUserInfo({ sub: SUB, email: 'user@example.com' });

      const result = await service.resolve(SUB, ACCESS_TOKEN);

      expect(result).toBe(existingUser);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('再取得しても見つからない場合（email 衝突）は 401 とする', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.user.create.mockRejectedValue(uniqueViolation(['email']));
      mockUserInfo({ sub: SUB, email: 'user@example.com' });

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('unique 制約違反以外のエラーは握りつぶさず再送出する', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('DB connection lost'));
      mockUserInfo({ sub: SUB, email: 'user@example.com' });

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        'DB connection lost',
      );
    });
  });
});
