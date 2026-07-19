/**
 * Cognito 認証に関する環境変数を読み取り、型付きの設定オブジェクトへ変換する。
 *
 * 起動時に一度だけ検証し、不足があれば即座に throw する。
 * 起動後に設定不備で 401 を量産させないための方針。
 *
 * issuer は region / userPoolId から一意に決まるため環境変数にせず導出する
 * （値の食い違いによる検証失敗を防ぐ）。
 */
export interface AuthConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  /** OIDC issuer。JWT の iss claim と突き合わせる */
  issuer: string;
  /** 初回 User 作成時に email / name を取得する UserInfo エンドポイント */
  userInfoUrl: string;
}

const REQUIRED_ENV_KEYS = [
  'COGNITO_REGION',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'COGNITO_USERINFO_URL',
] as const;

/**
 * 環境変数から AuthConfig を組み立てる。
 * env を引数で受け取るのはテストから差し替えられるようにするため。
 */
export function loadAuthConfig(
  env: Record<string, string | undefined> = process.env,
): AuthConfig {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Cognito 認証に必要な環境変数が設定されていません: ${missing.join(', ')}`,
    );
  }

  const region = env.COGNITO_REGION!.trim();
  const userPoolId = env.COGNITO_USER_POOL_ID!.trim();

  return {
    region,
    userPoolId,
    clientId: env.COGNITO_CLIENT_ID!.trim(),
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    userInfoUrl: env.COGNITO_USERINFO_URL!.trim(),
  };
}

/** Nest の DI で AuthConfig を注入するためのトークン */
export const AUTH_CONFIG = 'AUTH_CONFIG';
