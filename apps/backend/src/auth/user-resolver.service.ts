import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';

/**
 * UserInfo エンドポイントのレスポンスのうち、User 作成に使う項目。
 *
 * 外部から受け取る値であるため、型キャストではなく parseUserInfo で
 * 実行時に検証してからこの型として扱う。
 */
interface UserInfo {
  sub: string;
  email: string;
  name: string | null;
}

/** UserInfo 呼び出しのタイムアウト（ミリ秒） */
const USERINFO_TIMEOUT_MS = 5000;

/** unique 制約違反を表す Prisma のエラーコード */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * 検証済みの Cognito sub から、アプリケーション DB の User を解決する。
 *
 * Guard から DB アクセスと外部 API 呼び出しを分離するための Service
 * （認証・認可設計書 9.4 / 10.4）。
 *
 * 処理:
 *   1. cognitoSub で User を検索する
 *   2. 存在すればそれを返す
 *   3. 存在しなければ UserInfo を取得し、User を作成して返す
 *
 * UserInfo の呼び出しは User が存在しない初回のみ行う
 * （通常の API リクエストごとには実行しない。認証・認可設計書 10.3）。
 */
@Injectable()
export class UserResolverService {
  private readonly logger = new Logger(UserResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async resolve(sub: string, accessToken: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { cognitoSub: sub },
    });
    if (existing) {
      return existing;
    }

    return this.createFromUserInfo(sub, accessToken);
  }

  /**
   * UserInfo から属性を取得して User を作成する。
   *
   * 初回ログイン直後は画面表示のために複数の API リクエストが同時に発行され、
   * 同一 cognitoSub の User 作成が並行して走りうる。
   * DB の unique 制約を最終的な整合性の担保とし、制約違反時はエラーにせず
   * 既存 User を再取得して返す（認証・認可設計書 10.5）。
   */
  private async createFromUserInfo(
    sub: string,
    accessToken: string,
  ): Promise<User> {
    const userInfo = await this.fetchUserInfo(sub, accessToken);

    try {
      const created = await this.prisma.user.create({
        data: {
          cognitoSub: sub,
          email: userInfo.email,
          name: userInfo.name,
        },
      });
      this.logger.log(
        `初回ログインのため User を作成しました（id: ${created.id}）`,
      );
      return created;
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error;
      }

      // 並行リクエストが先に作成した場合。再取得して返す。
      const existing = await this.prisma.user.findUnique({
        where: { cognitoSub: sub },
      });
      if (existing) {
        return existing;
      }

      // cognitoSub 以外（email）の unique 制約違反。
      // 同一メールアドレスの User が別の cognitoSub で既に存在する状態であり、
      // 自動では解決できないため認証を通さない。
      this.logger.error(
        `User の作成に失敗しました。email が別の cognitoSub で登録済みです（sub: ${sub}）`,
      );
      throw new UnauthorizedException();
    }
  }

  /**
   * Cognito の UserInfo エンドポイントから email / name を取得する。
   *
   * Access Token には email / name が含まれないため必要になる
   * （認証・認可設計書 7.1）。
   *
   * 失敗時の扱いは原因によって分類する（認証・認可設計書 17.4）。
   *   401 / 403        … token が拒否された     → 401 UnauthorizedException
   *   その他のエラー応答  … 外部サービスの一時障害 → 503 ServiceUnavailableException
   *   接続不能 / タイムアウト … 外部サービスの一時障害 → 503 ServiceUnavailableException
   *   JSON 不正 / 形式不正  … 外部サービスの不正応答 → 502 BadGatewayException
   *
   * 認証切れ（401）と外部サービス障害を混同すると、Cognito の一時的な不調で
   * 正当なユーザーが強制ログアウトされてしまうため区別する。
   */
  private async fetchUserInfo(
    sub: string,
    accessToken: string,
  ): Promise<UserInfo> {
    let response: Response;
    try {
      response = await fetch(this.config.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(USERINFO_TIMEOUT_MS),
      });
    } catch (error) {
      // 接続不能・DNS 失敗・タイムアウト（AbortSignal.timeout）。
      // token の正当性とは無関係なため 401 にしない。
      this.logger.error(
        `UserInfo エンドポイントへ接続できませんでした: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException();
    }

    if (!response.ok) {
      throw this.toUserInfoError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // 200 系だが JSON として解釈できない。外部サービスからの不正応答。
      this.logger.error(
        'UserInfo エンドポイントのレスポンスを JSON として解釈できませんでした',
      );
      throw new BadGatewayException();
    }

    return this.parseUserInfo(body, sub);
  }

  /**
   * UserInfo のエラー応答を、原因に応じた例外へ変換する。
   *
   * 401 / 403 のみ「token が拒否された」とみなす。
   * 5xx や 429 を 401 に倒すと、フロントエンドが認証切れと誤認して
   * ログアウトしてしまうため分けている（認証・認可設計書 17.1 / 17.4）。
   */
  private toUserInfoError(status: number): Error {
    if (status === 401 || status === 403) {
      this.logger.warn(
        `UserInfo エンドポイントが token を拒否しました（status: ${status}）`,
      );
      return new UnauthorizedException();
    }

    this.logger.error(
      `UserInfo エンドポイントが異常を返しました（status: ${status}）`,
    );
    return new ServiceUnavailableException();
  }

  /**
   * UserInfo のレスポンスを実行時に検証する。
   *
   * 外部から受け取った値をそのまま DB へ保存しないため、
   * 型キャストではなく値を検査する。
   *
   * 検証内容:
   *   - null や配列ではない object であること
   *   - sub が空白でない文字列であること
   *   - sub が検証済み Access Token の sub と一致すること
   *   - email が空白でない文字列であること
   *   - name は文字列または未設定であること
   *
   * @param expectedSub 検証済み Access Token から取得した sub
   */
  private parseUserInfo(body: unknown, expectedSub: string): UserInfo {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw this.invalidUserInfo('レスポンスが object ではありません');
    }

    const { sub, email, name } = body as Record<string, unknown>;

    if (!this.isNonBlankString(sub)) {
      throw this.invalidUserInfo('sub が空白でない文字列ではありません');
    }

    // 別ユーザーの UserInfo を掴んで User を作成してしまわないよう、
    // 検証済み Access Token の sub と一致することを確認する。
    if (sub !== expectedSub) {
      throw this.invalidUserInfo('sub が Access Token の sub と一致しません');
    }

    // email が取得できない場合、架空の値を保存せず User を作成しない
    // （認証・認可設計書 10.3）。
    if (!this.isNonBlankString(email)) {
      throw this.invalidUserInfo('email が空白でない文字列ではありません');
    }

    if (name !== undefined && name !== null && typeof name !== 'string') {
      throw this.invalidUserInfo('name が文字列ではありません');
    }

    return {
      sub,
      email: email.trim(),
      // name は取得できない場合を考慮し nullable（認証・認可設計書 10.3）。
      // 空白のみの場合も値なしとして扱う。
      name: this.isNonBlankString(name) ? name.trim() : null,
    };
  }

  /**
   * 不正な UserInfo レスポンスを外部サービスからの不正応答として扱う。
   *
   * 理由はログにのみ記録し、レスポンスへは含めない
   * （個人情報・内部情報を外部へ出さない。認証・認可設計書 20）。
   */
  private invalidUserInfo(reason: string): Error {
    this.logger.error(`UserInfo のレスポンスが不正です: ${reason}`);
    return new BadGatewayException();
  }

  private isNonBlankString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_VIOLATION
    );
  }
}
