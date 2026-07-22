import { Amplify } from 'aws-amplify';

/**
 * Amplify Auth v6 を Cognito Managed Login 向けに設定する。
 *
 * 設定値は環境変数（VITE_COGNITO_*）から読み取る。実値は Terraform の
 * output（cognito_user_pool_id / cognito_app_client_id / hosted_ui_domain 等）
 * から設定する。
 *
 * - client secret は使わない（public client。認証・認可設計書 5.1）
 * - Authorization Code Grant + PKCE（responseType: 'code'。PKCE は Amplify が担う）
 * - scope は Terraform の allowed_oauth_scopes と一致させる
 *
 * App のレンダリング前に一度だけ呼び出す。
 */
export function configureAmplify(): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
        loginWith: {
          oauth: {
            // ホスト名のみ（https:// やパスは含めない）
            domain: import.meta.env.VITE_COGNITO_DOMAIN,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN],
            redirectSignOut: [import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT],
            responseType: 'code',
          },
        },
      },
    },
  });
}
