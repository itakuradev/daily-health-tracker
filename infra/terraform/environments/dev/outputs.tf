# ==========================================================================
# 出力
#
# 機密値（DB パスワード / DATABASE_URL / Secret 値 / Client Secret）は出力しない。
# ==========================================================================

# --- Network --------------------------------------------------------------

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_app_subnet_ids" {
  description = "Public Application Subnet の ID"
  value       = aws_subnet.public_app[*].id
}

output "private_db_subnet_ids" {
  description = "Private DB Subnet の ID"
  value       = aws_subnet.private_db[*].id
}

# --- ECR / ECS / ALB ------------------------------------------------------

output "ecr_repository_url" {
  description = "backend image を push する ECR Repository の URL（shared 管理。data source 参照）"
  value       = data.aws_ecr_repository.backend.repository_url
}

output "alb_dns_name" {
  description = "ALB の DNS 名。Stage 1 の疎通確認は http://<この値>/api/health"
  value       = aws_lb.main.dns_name
}

output "ecs_cluster_name" {
  description = "ECS Cluster 名"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS Service 名"
  value       = aws_ecs_service.backend.name
}

output "ecs_task_definition_family" {
  description = "ECS Task Definition family（one-off task 実行時に指定）"
  value       = aws_ecs_task_definition.backend.family
}

output "ecs_task_definition_arn" {
  description = "ECS Task Definition の ARN（リビジョン込み）"
  value       = aws_ecs_task_definition.backend.arn
}

output "ecs_security_group_id" {
  description = "ECS Task に付与する Security Group ID（one-off task 実行時に指定）"
  value       = aws_security_group.ecs.id
}

# --- Database / Secrets（値そのものは出さない） ---------------------------

output "rds_endpoint_address" {
  description = "RDS のエンドポイント（ホスト名のみ。認証情報は含まない）"
  value       = aws_db_instance.main.address
}

output "database_url_secret_arn" {
  description = "DATABASE_URL を格納した Secrets Manager Secret の ARN（値ではない）"
  value       = aws_secretsmanager_secret.database_url.arn
}

# --- Cognito --------------------------------------------------------------

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID（public client。Secret なし）"
  value       = aws_cognito_user_pool_client.spa.id
}

output "cognito_issuer_url" {
  description = "OIDC Issuer URL（JWT 検証の issuer）"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "cognito_hosted_ui_domain" {
  description = "Managed Login ドメイン（Base URL。output 名は互換のため据え置き）"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_authorization_endpoint" {
  description = "Authorization endpoint"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com/oauth2/authorize"
}

output "cognito_token_endpoint" {
  description = "Token endpoint"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com/oauth2/token"
}

output "cognito_userinfo_endpoint" {
  description = "UserInfo endpoint"
  value       = local.cognito_userinfo_url
}

# --- バックエンド実装（別スレッド）へ渡す推奨環境変数名と値 -----------------
#
# 現在の backend コードには Cognito 系の環境変数がまだ存在しないため、
# アプリコードは変更せず、推奨名と値のみをここで提示する。
# 実際に採用する変数名はアプリ実装側で確定させる。
output "cognito_backend_env_suggestion" {
  description = "backend の JWT 検証で使う想定の環境変数（推奨名。機密ではない値のみ）"
  value = {
    COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
    COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.spa.id
    COGNITO_ISSUER       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
    COGNITO_USERINFO_URL = local.cognito_userinfo_url
    COGNITO_REGION       = var.aws_region
  }
}
