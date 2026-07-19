import { Inject, Injectable, Logger } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';

/**
 * Access Token の検証結果として、後続処理が利用する claim のみを取り出した型。
 *
 * User の解決に必要なのは sub だけであり、余分な claim を持ち回らない。
 * email / name は Access Token に含まれないため、ここには現れない
 * （認証・認可設計書 7.1）。
 */
export interface VerifiedAccessToken {
  sub: string;
}

/**
 * Cognito が発行した Access Token を検証する。
 *
 * 検証項目（認証・認可設計書 9.2）:
 *   - JWT 形式が正しいこと
 *   - 署名が正しいこと（User Pool の JWKS で検証）
 *   - 有効期限が切れていないこと
 *   - issuer が想定の User Pool であること
 *   - token_use が access であること
 *   - client_id が想定の App Client であること
 *
 * JWKS の取得・キャッシュ・鍵ローテーション追従は aws-jwt-verify が担う。
 * リクエストごとに Cognito へ問い合わせない。
 */
@Injectable()
export class CognitoJwtVerifierService {
  private readonly logger = new Logger(CognitoJwtVerifierService.name);
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      clientId: config.clientId,
      tokenUse: 'access',
    });
  }

  /**
   * Access Token を検証し、検証済みの sub を返す。
   *
   * 検証に失敗した場合は理由をログに残したうえで null を返す。
   * 呼び出し側（Guard）は理由を外部へ出さず一律 401 とする
   * （認証・認可設計書 20「エラーレスポンスに内部情報を含めない」）。
   */
  async verify(token: string): Promise<VerifiedAccessToken | null> {
    try {
      const payload = await this.verifier.verify(token);
      return { sub: payload.sub };
    } catch (error) {
      this.logger.warn(
        `Access Token の検証に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
