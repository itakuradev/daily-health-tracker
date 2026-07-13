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
