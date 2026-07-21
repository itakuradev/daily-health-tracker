import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  FetchError,
  JwkInvalidKtyError,
  JwkInvalidUseError,
  JwksNotAvailableInCacheError,
  JwksValidationError,
  JwkValidationError,
  JwtInvalidClaimError,
  JwtInvalidSignatureAlgorithmError,
  JwtInvalidSignatureError,
  JwtParseError,
  JwtWithoutValidKidError,
  KidNotFoundInJwksError,
  ParameterValidationError,
  WaitPeriodNotYetEndedJwkError,
} from 'aws-jwt-verify/error';
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
 * 「JWKS 取得・鍵取得・外部通信の失敗」を表す aws-jwt-verify のエラー型。
 *
 * Token が無効なのではなく、バックエンドが Token を検証できなかったケース。
 * 一時障害として 503 に分類する（認証・認可設計書 17.6）。
 *
 * new 可能なコンストラクタとして明示列挙し、instanceof で判定する。
 * 文字列比較や推測は行わない。
 */
const JWKS_RETRIEVAL_ERRORS = [
  FetchError, // JWKS 取得の通信失敗（NonRetryableFetchError もサブクラスとして含む）
  WaitPeriodNotYetEndedJwkError, // 連続失敗後のバックオフ中（一時的）
  JwksNotAvailableInCacheError, // JWKS がキャッシュ未取得
  JwksValidationError, // 取得した JWKS の内容が不正
  JwkValidationError, // 取得した JWK の内容が不正
  JwkInvalidUseError, // JWK の use が想定外
  JwkInvalidKtyError, // JWK の kty が想定外
] as const;

/**
 * 「Access Token 自体が無効」であることを表す aws-jwt-verify のエラー型。
 *
 * 401 に分類する（認証・認可設計書 17.6）。
 * JwtInvalidClaimError は issuer / audience / scope / expired / notBefore /
 * token_use / client_id / group などの claim 検証エラーの基底クラスであり、
 * それらのサブクラスをまとめて捕捉する。
 */
const TOKEN_INVALID_ERRORS = [
  JwtParseError, // JWT 形式が不正
  JwtInvalidSignatureError, // 署名が不正
  JwtInvalidSignatureAlgorithmError, // 署名アルゴリズムが想定外
  JwtInvalidClaimError, // claim 検証エラー全般（exp / token_use / client_id 等）
  JwtWithoutValidKidError, // Token に有効な kid がない
  KidNotFoundInJwksError, // 最新 JWKS にも存在しない kid（無効・不審な Token）
  // CognitoJwtVerifier では issuer 不一致は JwtInvalidIssuerError ではなく
  // ParameterValidationError（"issuer not configured" / "issuer must be
  // provided"）として投げられる。userPoolId / clientId / tokenUse の構築時
  // バリデーションは .create()（コンストラクタ）で発生し verify() の catch には
  // 到達しないため、verify() 実行時に到達しうる ParameterValidationError は
  // Token の iss に起因するもののみ。よって Token 無効（401）に分類する。
  ParameterValidationError,
] as const;

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
   * 失敗時は原因を区別する（認証・認可設計書 17.6）。
   *   Token 自体が無効        … null を返す（Guard が 401 にする）
   *   JWKS 取得・外部通信の障害 … ServiceUnavailableException（503）を送出
   *   予期しない例外          … 元の例外をそのまま再送出（500）
   *
   * JWKS 取得障害を 401 に倒すと、フロントエンドが認証切れと誤認して
   * 正当なユーザーをログアウトさせてしまうため区別する。
   *
   * 失敗理由はエラークラス名のみをログに記録する。
   * Token 全文・claim・個人情報はログへ出さない
   * （認証・認可設計書 20）。
   */
  async verify(token: string): Promise<VerifiedAccessToken | null> {
    try {
      const payload = await this.verifier.verify(token);
      return { sub: payload.sub };
    } catch (error) {
      if (this.isJwksRetrievalError(error)) {
        this.logger.error(
          `Access Token を検証できませんでした（JWKS 取得/外部通信の障害）: ${this.errorName(error)}`,
        );
        throw new ServiceUnavailableException();
      }

      if (this.isTokenInvalidError(error)) {
        this.logger.warn(`Access Token が無効です: ${this.errorName(error)}`);
        return null;
      }

      // どちらにも分類できない予期しない例外。認証失敗として握りつぶさず、
      // 元の例外をそのまま送出して 500 とする。
      this.logger.error(
        `Access Token の検証中に予期しないエラーが発生しました: ${this.errorName(error)}`,
      );
      throw error;
    }
  }

  private isJwksRetrievalError(error: unknown): boolean {
    return JWKS_RETRIEVAL_ERRORS.some((type) => error instanceof type);
  }

  private isTokenInvalidError(error: unknown): boolean {
    return TOKEN_INVALID_ERRORS.some((type) => error instanceof type);
  }

  /** ログ用にエラークラス名のみを取り出す（Token・claim を含めない） */
  private errorName(error: unknown): string {
    if (error instanceof Error) {
      return error.constructor.name;
    }
    return 'UnknownError';
  }
}
