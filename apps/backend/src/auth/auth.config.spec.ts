import { loadAuthConfig } from './auth.config';

const validEnv = {
  COGNITO_REGION: 'ap-northeast-1',
  COGNITO_USER_POOL_ID: 'ap-northeast-1_example',
  COGNITO_CLIENT_ID: 'example-client-id',
  COGNITO_USERINFO_URL:
    'https://example.auth.ap-northeast-1.amazoncognito.com/oauth2/userInfo',
};

describe('loadAuthConfig', () => {
  it('必要な環境変数が揃っていれば設定を返す', () => {
    const config = loadAuthConfig(validEnv);

    expect(config.region).toBe('ap-northeast-1');
    expect(config.userPoolId).toBe('ap-northeast-1_example');
    expect(config.clientId).toBe('example-client-id');
    expect(config.userInfoUrl).toBe(validEnv.COGNITO_USERINFO_URL);
  });

  it('issuer を region と userPoolId から導出する', () => {
    const config = loadAuthConfig(validEnv);

    expect(config.issuer).toBe(
      'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_example',
    );
  });

  it('前後の空白を除去する', () => {
    const config = loadAuthConfig({
      ...validEnv,
      COGNITO_CLIENT_ID: '  example-client-id  ',
    });

    expect(config.clientId).toBe('example-client-id');
  });

  it.each([
    'COGNITO_REGION',
    'COGNITO_USER_POOL_ID',
    'COGNITO_CLIENT_ID',
    'COGNITO_USERINFO_URL',
  ])('%s が未設定なら throw する', (key) => {
    const env = { ...validEnv, [key]: undefined };

    expect(() => loadAuthConfig(env)).toThrow(key);
  });

  it('空文字は未設定として扱う', () => {
    const env = { ...validEnv, COGNITO_CLIENT_ID: '   ' };

    expect(() => loadAuthConfig(env)).toThrow('COGNITO_CLIENT_ID');
  });

  it('不足している変数をすべて列挙する', () => {
    expect(() => loadAuthConfig({})).toThrow(
      /COGNITO_REGION.*COGNITO_USER_POOL_ID.*COGNITO_CLIENT_ID.*COGNITO_USERINFO_URL/,
    );
  });
});
