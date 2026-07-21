import { generateKeyPairSync, createSign } from 'crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  FetchError,
  JwkInvalidKtyError,
  JwkInvalidUseError,
  JwksNotAvailableInCacheError,
  JwksValidationError,
  JwkValidationError,
  JwtExpiredError,
  JwtInvalidSignatureError,
  JwtParseError,
  JwtWithoutValidKidError,
  KidNotFoundInJwksError,
  NonRetryableFetchError,
  NotSupportedError,
  ParameterValidationError,
  WaitPeriodNotYetEndedJwkError,
} from 'aws-jwt-verify/error';
import type { AuthConfig } from './auth.config';
import { CognitoJwtVerifierService } from './cognito-jwt.verifier';

/**
 * 実 Cognito を使わずに検証ロジックを確認するため、
 * テスト用の RSA 鍵ペアで JWT を署名し、対応する JWKS を verifier へ注入する。
 */
const KEY_ID = 'test-key-id';

const config: AuthConfig = {
  region: 'ap-northeast-1',
  userPoolId: 'ap-northeast-1_example',
  clientId: 'example-client-id',
  issuer:
    'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_example',
  userInfoUrl:
    'https://example.auth.ap-northeast-1.amazoncognito.com/oauth2/userInfo',
};

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

interface TokenClaims {
  sub?: string;
  iss?: string;
  token_use?: string;
  client_id?: string;
  /** 秒単位の絶対時刻。省略時は 1 時間後 */
  exp?: number;
}

function signToken(claims: TokenClaims = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: KEY_ID, typ: 'JWT' };
  const payload = {
    sub: 'cognito-sub-001',
    iss: config.issuer,
    token_use: 'access',
    client_id: config.clientId,
    iat: now,
    exp: now + 3600,
    ...claims,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`;

  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey);

  return `${signingInput}.${base64url(signature)}`;
}

function buildVerifier(): CognitoJwtVerifierService {
  const service = new CognitoJwtVerifierService(config);

  // JWKS をキャッシュへ注入し、Cognito への実通信を発生させない。
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: KEY_ID,
    alg: 'RS256',
    use: 'sig',
  };
  (
    service as unknown as {
      verifier: { cacheJwks: (jwks: { keys: unknown[] }) => void };
    }
  ).verifier.cacheJwks({ keys: [jwk] });

  return service;
}

/** 内部の aws-jwt-verify verifier.verify() を差し替え、指定の例外を投げさせる */
function mockLibraryVerifyThrows(
  service: CognitoJwtVerifierService,
  error: unknown,
): void {
  const verifier = (service as unknown as { verifier: { verify: unknown } })
    .verifier;
  verifier.verify = jest.fn().mockRejectedValue(error);
}

describe('CognitoJwtVerifierService', () => {
  let service: CognitoJwtVerifierService;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    service = buildVerifier();
    // 検証失敗時のログはテスト出力を汚すため抑制する
    warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);
  });

  describe('正常系', () => {
    it('正当な Access Token を検証して sub を返す', async () => {
      const result = await service.verify(signToken());

      expect(result).toEqual({ sub: 'cognito-sub-001' });
    });
  });

  describe('Token 自体が無効な場合は null（→ 401）', () => {
    it('有効期限が切れた token を拒否する', async () => {
      const expired = signToken({ exp: Math.floor(Date.now() / 1000) - 60 });

      expect(await service.verify(expired)).toBeNull();
    });

    it('issuer が異なる token を拒否する', async () => {
      const token = signToken({
        iss: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_other',
      });

      expect(await service.verify(token)).toBeNull();
    });

    it('token_use が access でない token を拒否する（ID Token を拒否する）', async () => {
      expect(await service.verify(signToken({ token_use: 'id' }))).toBeNull();
    });

    it('client_id が異なる token を拒否する', async () => {
      const token = signToken({ client_id: 'another-client-id' });

      expect(await service.verify(token)).toBeNull();
    });

    it('署名が改ざんされた token を拒否する', async () => {
      const [header, payload] = signToken().split('.');
      const tampered = `${header}.${payload}.${base64url('invalid-signature')}`;

      expect(await service.verify(tampered)).toBeNull();
    });

    it('JWT 形式でない文字列を拒否する', async () => {
      expect(await service.verify('not-a-jwt')).toBeNull();
    });

    // ライブラリが Token 無効として投げる各エラー型を、実際のクラスで確認する。
    it.each([
      ['JwtParseError', new JwtParseError('bad jwt')],
      ['JwtInvalidSignatureError', new JwtInvalidSignatureError('bad sig')],
      [
        'JwtExpiredError（JwtInvalidClaimError 系）',
        new JwtExpiredError('expired', 0),
      ],
      ['JwtWithoutValidKidError', new JwtWithoutValidKidError('no kid')],
      ['KidNotFoundInJwksError', new KidNotFoundInJwksError('kid not found')],
      // CognitoJwtVerifier では issuer 不一致がこの型で投げられる（実経路の
      // 「issuer が異なる token を拒否する」でも到達している）。
      [
        'ParameterValidationError（issuer 不一致）',
        new ParameterValidationError('issuer not configured: https://other'),
      ],
    ])('%s は null を返す', async (_name, error) => {
      mockLibraryVerifyThrows(service, error);

      expect(await service.verify(signToken())).toBeNull();
    });
  });

  describe('JWKS 取得・外部通信の障害は 503 を送出（→ 認証切れにしない）', () => {
    it('実際の JWKS 取得失敗経路で 503 を送出する（到達不能な JWKS URI）', async () => {
      // キャッシュを注入していない verifier を用意し、
      // JWKS URI を到達不能なローカルポートへ向けて実際の取得失敗を起こす。
      const svc = new CognitoJwtVerifierService(config);
      (svc as unknown as { verifier: { jwksUri: string } }).verifier.jwksUri =
        'http://127.0.0.1:59999/.well-known/jwks.json';
      jest.spyOn(svc['logger'], 'error').mockImplementation(() => undefined);

      await expect(svc.verify(signToken())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    // ライブラリが JWKS/鍵取得の失敗として投げる各エラー型を、実際のクラスで確認する。
    it.each([
      ['FetchError', new FetchError('https://jwks', 'connect failed')],
      [
        'NonRetryableFetchError',
        new NonRetryableFetchError('https://jwks', 'status 500'),
      ],
      [
        'WaitPeriodNotYetEndedJwkError',
        new WaitPeriodNotYetEndedJwkError('backoff'),
      ],
      [
        'JwksNotAvailableInCacheError',
        new JwksNotAvailableInCacheError('not cached'),
      ],
      ['JwksValidationError', new JwksValidationError('invalid jwks')],
      ['JwkValidationError', new JwkValidationError('invalid jwk')],
      ['JwkInvalidUseError', new JwkInvalidUseError('bad use', 'enc')],
      ['JwkInvalidKtyError', new JwkInvalidKtyError('bad kty', 'EC')],
    ])('%s は 503 を送出する', async (_name, error) => {
      mockLibraryVerifyThrows(service, error);

      await expect(service.verify(signToken())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('503 を返す際に null へ変換しない', async () => {
      mockLibraryVerifyThrows(service, new FetchError('https://jwks', 'boom'));

      await expect(service.verify(signToken())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('予期しない例外は再送出（→ 500）', () => {
    it('JwtBaseError でない例外は null へ変換せず再送出する', async () => {
      const unexpected = new Error('unexpected boom');
      mockLibraryVerifyThrows(service, unexpected);

      await expect(service.verify(signToken())).rejects.toBe(unexpected);
    });

    it('401/503 のどちらにも該当しない JwtBaseError は再送出する', async () => {
      // NotSupportedError は JwtBaseError だが Token 無効・JWKS 障害の
      // いずれの allowlist にも含まれないため、握りつぶさず再送出する。
      const unclassified = new NotSupportedError('not supported');
      mockLibraryVerifyThrows(service, unclassified);

      await expect(service.verify(signToken())).rejects.toBe(unclassified);
    });

    it('Error でない throw も認証失敗にせず再送出する', async () => {
      mockLibraryVerifyThrows(service, 'string thrown');

      await expect(service.verify(signToken())).rejects.toBe('string thrown');
    });
  });

  describe('情報秘匿とログ', () => {
    it('検証失敗の理由を外部へ返さず null のみを返す', async () => {
      const result = await service.verify('not-a-jwt');

      expect(result).toBeNull();
      // 理由はログにのみ記録される
      expect(warnSpy).toHaveBeenCalled();
    });

    it('無効 Token のログにエラークラス名のみを含め、Token 全文を含めない', async () => {
      const token = signToken({ token_use: 'id' });

      await service.verify(token);

      const logged = warnSpy.mock.calls
        .map((c: unknown[]) => String(c[0]))
        .join('\n');
      expect(logged).toContain('CognitoJwtInvalidTokenUseError');
      expect(logged).not.toContain(token);
    });

    it('外部障害のログに Token 全文を含めない', async () => {
      const token = signToken();
      mockLibraryVerifyThrows(service, new FetchError('https://jwks', 'boom'));

      await expect(service.verify(token)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      const logged = errorSpy.mock.calls
        .map((c: unknown[]) => String(c[0]))
        .join('\n');
      expect(logged).toContain('FetchError');
      expect(logged).not.toContain(token);
    });

    it('無効 Token と外部障害を異なるログレベルで区別する', async () => {
      // 無効 Token は warn
      await service.verify(signToken({ token_use: 'id' }));
      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();

      warnSpy.mockClear();
      errorSpy.mockClear();

      // 外部障害は error
      mockLibraryVerifyThrows(service, new FetchError('https://jwks', 'boom'));
      await expect(service.verify(signToken())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
