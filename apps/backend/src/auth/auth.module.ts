import { Global, Module } from '@nestjs/common';
import { AUTH_CONFIG, loadAuthConfig } from './auth.config';
import { AuthGuard } from './auth.guard';
import { CognitoJwtVerifierService } from './cognito-jwt.verifier';
import { MeController } from './me.controller';
import { UserResolverService } from './user-resolver.service';

/**
 * 認証関連の provider をまとめるモジュール。
 *
 * 各機能モジュールの Controller が `@UseGuards(AuthGuard)` を使うため、
 * PrismaModule と同様に @Global として全体へ公開する
 * （各モジュールで個別に import する定型コードを避けるため）。
 */
@Global()
@Module({
  controllers: [MeController],
  providers: [
    {
      provide: AUTH_CONFIG,
      // 環境変数が不足していれば起動時に throw する。
      // 起動後に設定不備で 401 を量産させない。
      useFactory: () => loadAuthConfig(),
    },
    CognitoJwtVerifierService,
    UserResolverService,
    AuthGuard,
  ],
  exports: [
    AUTH_CONFIG,
    CognitoJwtVerifierService,
    UserResolverService,
    AuthGuard,
  ],
})
export class AuthModule {}
