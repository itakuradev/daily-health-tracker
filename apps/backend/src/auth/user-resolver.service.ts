import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';

/** UserInfo エンドポイントのレスポンスのうち、User 作成に使う項目 */
interface UserInfoResponse {
  sub?: string;
  email?: string;
  name?: string;
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
    const userInfo = await this.fetchUserInfo(accessToken);

    // email が取得できない場合、架空の値を保存せずエラーとして扱う
    // （認証・認可設計書 10.3）。
    if (!userInfo.email) {
      this.logger.error(
        `UserInfo に email が含まれないため User を作成できません（sub: ${sub}）`,
      );
      throw new UnauthorizedException();
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          cognitoSub: sub,
          email: userInfo.email,
          name: userInfo.name ?? null,
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
   */
  private async fetchUserInfo(accessToken: string): Promise<UserInfoResponse> {
    let response: Response;
    try {
      response = await fetch(this.config.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(USERINFO_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        `UserInfo エンドポイントへの接続に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new UnauthorizedException();
    }

    if (!response.ok) {
      this.logger.error(
        `UserInfo エンドポイントが異常を返しました（status: ${response.status}）`,
      );
      throw new UnauthorizedException();
    }

    return (await response.json()) as UserInfoResponse;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_VIOLATION
    );
  }
}
