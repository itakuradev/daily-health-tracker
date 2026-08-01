# 出力（shared）。
# environments/dev は data source で ECR を参照するため、これらの output は
# 主に確認・他ツール連携用。

output "ecr_repository_name" {
  description = "ECR Repository 名"
  value       = aws_ecr_repository.backend.name
}

output "ecr_repository_url" {
  description = "backend image を push する ECR Repository の URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_arn" {
  description = "ECR Repository の ARN"
  value       = aws_ecr_repository.backend.arn
}

# --- ローカル開発専用 Cognito ---------------------------------------------
#
# ローカルの frontend / backend の .env に設定する値。Secret（Client Secret 等）は
# 存在しない（public client）ため出力しない。issuer は backend が
# COGNITO_REGION と COGNITO_USER_POOL_ID から導出するため出力しない。

output "cognito_local_region" {
  description = "AWS リージョン（backend の COGNITO_REGION）"
  value       = var.aws_region
}

output "cognito_local_user_pool_id" {
  description = "ローカル用 Cognito User Pool ID（VITE_COGNITO_USER_POOL_ID / COGNITO_USER_POOL_ID）"
  value       = aws_cognito_user_pool.local.id
}

output "cognito_local_client_id" {
  description = "ローカル用 App Client ID（VITE_COGNITO_CLIENT_ID / COGNITO_CLIENT_ID）。public client のため Secret なし"
  value       = aws_cognito_user_pool_client.local.id
}

output "cognito_local_domain_host" {
  description = "Managed Login ドメインのホスト名のみ（VITE_COGNITO_DOMAIN。https:// やパスは含まない）"
  value       = "${aws_cognito_user_pool_domain.local.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_local_userinfo_url" {
  description = "UserInfo エンドポイントのフル URL（backend の COGNITO_USERINFO_URL）"
  value       = "https://${aws_cognito_user_pool_domain.local.domain}.auth.${var.aws_region}.amazoncognito.com/oauth2/userInfo"
}

output "cognito_local_redirect_sign_in" {
  description = "サインイン後のリダイレクト先（VITE_COGNITO_REDIRECT_SIGN_IN）。localhost のみ"
  value       = var.cognito_local_callback_urls[0]
}

output "cognito_local_redirect_sign_out" {
  description = "サインアウト後のリダイレクト先（VITE_COGNITO_REDIRECT_SIGN_OUT）。localhost のみ"
  value       = var.cognito_local_logout_urls[0]
}
