# ==========================================================================
# Cognito（shared 層：ローカル開発専用）
#
# ローカル開発（http://localhost:5173 の React / http://localhost:3000 の NestJS）で
# 継続利用するための Cognito を、環境をまたいで保持する shared root module で管理する。
# これにより environments/dev の terraform destroy でこの Cognito は削除されない。
#
# environments/dev の Cognito（daily-health-tracker-dev-...）とは別の User Pool を
# 新規作成し、両方を並存させる。dev の import・移行・削除は行わない。
#
# 命名は local.cognito_name_prefix（daily-health-tracker-local）を用い、dev 用と
# 衝突しないよう "local" を明示的に含める。Domain prefix は Account ID を suffix に
# 付けてグローバル一意にし、dev 用（-dev-<AccountID>）と必ず異なる prefix にする。
#
# PKCE は React SPA 側で実施する。Terraform 側は App Client の OAuth 設定
# （フロー種別・スコープ・Callback/Logout URL・secret なし）までを責務とする。
# ==========================================================================

resource "aws_cognito_user_pool" "local" {
  name = "${local.cognito_name_prefix}-users"

  # Managed Login を利用するため ESSENTIALS ティアにする（Lite では Managed Login 不可）。
  user_pool_tier = "ESSENTIALS"

  # email をログイン ID・ユーザー識別に使用する。
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # ユーザー名（email）の大文字小文字を区別しない。
  username_configuration {
    case_sensitive = false
  }

  # セルフサインアップ無効（管理者によるユーザー作成のみ）。
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  # MFA は初期無効。
  mfa_configuration = "OFF"

  # アカウント復旧は確認済み email を利用。
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # email / name はいずれも Cognito 標準属性で要件を満たせるため schema ブロックでは
  # 再定義しない（標準属性を schema で上書きすると Cognito 側の制約と衝突しやすいため）。

  tags = {
    Application = "auth"
    Usage       = "local-development"
  }
}

# React SPA（localhost）用の public client（Client Secret なし、Authorization Code + PKCE 前提）。
resource "aws_cognito_user_pool_client" "local" {
  name         = "${local.cognito_name_prefix}-spa-client"
  user_pool_id = aws_cognito_user_pool.local.id

  generate_secret = false # public SPA client

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"] # Authorization Code Grant
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  # localhost 用のみ（変数から参照。実値はハードコードしない）。
  # CloudFront / dev 環境の URL は含めない。
  callback_urls = var.cognito_local_callback_urls
  logout_urls   = var.cognito_local_logout_urls

  # ユーザー存在有無を秘匿する。
  prevent_user_existence_errors = "ENABLED"
}

# Managed Login 用ドメイン。prefix は AWS 全体でグローバル一意である必要があるため
# Account ID を suffix に付けて衝突を避ける。dev 用（-dev-<AccountID>）とは prefix が
# 異なるため（-local-<AccountID>）、グローバルにも重複しない。
# managed_login_version = 2 で Managed Login（新 UI）を有効化する（1 は旧 Hosted UI classic）。
resource "aws_cognito_user_pool_domain" "local" {
  domain                = "${local.cognito_name_prefix}-${data.aws_caller_identity.current.account_id}"
  user_pool_id          = aws_cognito_user_pool.local.id
  managed_login_version = 2
}

# Managed Login のブランディング。
# use_cognito_provided_values = true で Cognito 既定のスタイル・アセットを利用する。
# これが無いと Managed Login のログイン画面が正しく表示されないため必須。
# Domain 作成後に紐づける必要があるため depends_on を付ける。
resource "aws_cognito_managed_login_branding" "local" {
  user_pool_id                = aws_cognito_user_pool.local.id
  client_id                   = aws_cognito_user_pool_client.local.id
  use_cognito_provided_values = true

  depends_on = [aws_cognito_user_pool_domain.local]
}
