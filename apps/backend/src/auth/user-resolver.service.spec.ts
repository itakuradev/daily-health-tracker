import {
  BadGatewayException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
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

/** fetch のモック。UserInfo が返す JSON を差し替える */
function mockUserInfo(body: unknown, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

/** UserInfo がエラーステータスを返す状況を再現する */
function mockUserInfoStatus(status: number) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  });
}

/** UserInfo が 200 を返すが body を JSON として解釈できない状況を再現する */
function mockUserInfoBrokenJson() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
  });
}

/** 妥当な UserInfo レスポンス。個別の項目だけ上書きして使う */
function validUserInfo(overrides: Record<string, unknown> = {}) {
  return {
    sub: SUB,
    email: 'user@example.com',
    name: 'テスト太郎',
    ...overrides,
  };
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
    // ログはテスト出力を汚すため抑制する
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
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
      mockUserInfo(validUserInfo());

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

    it('name が空白のみの場合も null で作成する', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...existingUser, name: null });
      mockUserInfo(validUserInfo({ name: '   ' }));

      await service.resolve(SUB, ACCESS_TOKEN);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { cognitoSub: SUB, email: 'user@example.com', name: null },
      });
    });

    it('email / name の前後の空白を除去して保存する', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(existingUser);
      mockUserInfo(
        validUserInfo({
          email: '  user@example.com  ',
          name: '  テスト太郎  ',
        }),
      );

      await service.resolve(SUB, ACCESS_TOKEN);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          cognitoSub: SUB,
          email: 'user@example.com',
          name: 'テスト太郎',
        },
      });
    });
  });

  describe('UserInfo レスポンスの実行時検証', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
    });

    it('sub が一致する妥当なレスポンスなら User を作成する', async () => {
      prisma.user.create.mockResolvedValue(existingUser);
      mockUserInfo(validUserInfo());

      await expect(service.resolve(SUB, ACCESS_TOKEN)).resolves.toBe(
        existingUser,
      );
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it.each([
      ['sub が欠落している', validUserInfo({ sub: undefined })],
      ['sub が Access Token と一致しない', validUserInfo({ sub: 'other-sub' })],
      ['sub が空白のみ', validUserInfo({ sub: '   ' })],
      ['sub が文字列以外', validUserInfo({ sub: 12345 })],
      ['レスポンスが null', null],
      ['レスポンスが配列', [validUserInfo()]],
      ['レスポンスが文字列', 'unexpected'],
      ['email が欠落している', validUserInfo({ email: undefined })],
      ['email が空白のみ', validUserInfo({ email: '   ' })],
      ['email が文字列以外', validUserInfo({ email: 12345 })],
      ['email が object', validUserInfo({ email: { value: 'a@b.c' } })],
      ['name が文字列以外', validUserInfo({ name: 12345 })],
      ['name が配列', validUserInfo({ name: ['テスト太郎'] })],
    ])('%s 場合は User を作成せず 502 とする', async (_name, body) => {
      mockUserInfo(body);

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        BadGatewayException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('name が null の場合は不正としない', async () => {
      prisma.user.create.mockResolvedValue({ ...existingUser, name: null });
      mockUserInfo(validUserInfo({ name: null }));

      await service.resolve(SUB, ACCESS_TOKEN);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { cognitoSub: SUB, email: 'user@example.com', name: null },
      });
    });

    it('検証に失敗した理由を例外メッセージへ含めない', async () => {
      mockUserInfo(validUserInfo({ sub: 'other-sub' }));

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        new BadGatewayException(),
      );
    });
  });

  describe('UserInfo 障害時の分類', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
    });

    it.each([401, 403])(
      'UserInfo が %i を返した場合は token が拒否されたとみなし 401 とする',
      async (status) => {
        mockUserInfoStatus(status);

        await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
          UnauthorizedException,
        );
        expect(prisma.user.create).not.toHaveBeenCalled();
      },
    );

    it.each([500, 502, 503, 429, 400])(
      'UserInfo が %i を返した場合は一時障害として 503 とする（401 にしない）',
      async (status) => {
        mockUserInfoStatus(status);

        await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
          ServiceUnavailableException,
        );
        expect(prisma.user.create).not.toHaveBeenCalled();
      },
    );

    it('タイムアウトした場合は一時障害として 503 とする', async () => {
      // AbortSignal.timeout は AbortError を投げる
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('接続に失敗した場合は一時障害として 503 とする', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:443'));

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('Error 以外が throw された場合も一時障害として 503 とする', async () => {
      global.fetch = jest.fn().mockRejectedValue('文字列の例外');

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('200 だが JSON として解釈できない場合は 502 とする', async () => {
      mockUserInfoBrokenJson();

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.toThrow(
        BadGatewayException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('接続失敗の詳細を例外メッセージへ含めない', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:443'));

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.not.toThrow(
        /ECONNREFUSED/,
      );
    });

    it('レスポンスに Access Token を含めない', async () => {
      mockUserInfoStatus(500);

      await expect(service.resolve(SUB, ACCESS_TOKEN)).rejects.not.toThrow(
        new RegExp(ACCESS_TOKEN),
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
