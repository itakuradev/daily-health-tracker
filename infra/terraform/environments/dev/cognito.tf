# ==========================================================================
# Cognito
#
# User Pool / App Client（React SPA 用 public client）/ Managed Login Domain を管理する。
# ログイン画面は Managed Login（新しいホスト型 UI。旧 Hosted UI classic の後継）を使う。
# 実ユーザーは Terraform で作らない（AWS コンソール・運用手順から手動作成）。
#
# PKCE は React SPA 側で実施する。Terraform 側は App Client の OAuth 設定
# （フロー種別・スコープ・Callback/Logout URL・secret なし）までを責務とする。
# ==========================================================================

resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-users"

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

  # 属性設計:
  #   email : Cognito 標準属性。username_attributes = ["email"] によりログイン ID 兼
  #           必須属性となり、auto_verified_attributes で検証対象になる。
  #   name  : Cognito 標準の「任意」属性。UserInfo で取得できない場合を考慮し必須にしない。
  # email / name はいずれも標準属性で要件を満たせるため、schema ブロックでは再定義しない
  #   （標準属性を schema で上書きすると Cognito 側の制約と衝突しやすいため）。

  tags = {
    Application = "auth"
  }
}

# React SPA 用の public client（Client Secret なし、Authorization Code + PKCE 前提）。
resource "aws_cognito_user_pool_client" "spa" {
  name         = "${local.name_prefix}-spa-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false # public SPA client

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"] # Authorization Code Grant
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  # 将来 CloudFront 導入時は変数へ URL を追加すれば拡張できる。
  callback_urls = var.cognito_callback_urls
  logout_urls   = var.cognito_logout_urls

  # ユーザー存在有無を秘匿する。
  prevent_user_existence_errors = "ENABLED"
}

# Managed Login 用ドメイン。prefix は AWS 全体で一意である必要があるため
# Account ID を suffix に付けて衝突を避ける（値はハードコードしない）。
# managed_login_version = 2 で Managed Login（新 UI）を有効化する（1 は旧 Hosted UI classic）。
resource "aws_cognito_user_pool_domain" "main" {
  domain                = "${local.name_prefix}-${data.aws_caller_identity.current.account_id}"
  user_pool_id          = aws_cognito_user_pool.main.id
  managed_login_version = 2
}

# Managed Login のブランディング。
# use_cognito_provided_values = true で、Cognito 既定のスタイル・アセットを利用する
# （カスタム CSS/画像は指定しない）。Domain 作成後に紐づける必要がある。
resource "aws_cognito_managed_login_branding" "main" {
  user_pool_id                = aws_cognito_user_pool.main.id
  client_id                   = aws_cognito_user_pool_client.spa.id
  use_cognito_provided_values = true

  depends_on = [aws_cognito_user_pool_domain.main]
}
