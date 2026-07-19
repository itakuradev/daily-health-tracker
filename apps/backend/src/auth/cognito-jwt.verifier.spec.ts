import { generateKeyPairSync, createSign } from 'crypto';
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

describe('CognitoJwtVerifierService', () => {
  let service: CognitoJwtVerifierService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    service = buildVerifier();
    // 検証失敗時の warn ログはテスト出力を汚すため抑制する
    warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
  });

  it('正当な Access Token を検証して sub を返す', async () => {
    const result = await service.verify(signToken());

    expect(result).toEqual({ sub: 'cognito-sub-001' });
  });

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

  it('検証失敗の理由を外部へ返さず null のみを返す', async () => {
    const result = await service.verify('not-a-jwt');

    expect(result).toBeNull();
    // 理由はログにのみ記録される
    expect(warnSpy).toHaveBeenCalled();
  });
});
