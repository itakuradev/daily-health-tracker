# ==========================================================================
# 入力変数（shared）
# ==========================================================================

variable "aws_region" {
  description = "リソースを作成する AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project" {
  description = "プロジェクト名。タグの接頭辞に使用する"
  type        = string
  default     = "daily-health-tracker"
}

variable "environment" {
  description = "環境タグの値。shared は環境をまたぐ永続層のため既定 shared"
  type        = string
  default     = "shared"
}

variable "ecr_repository_name" {
  description = "既存の ECR Repository 名（import で取り込む）"
  type        = string
  default     = "daily-health-tracker-backend"
}

variable "ecr_untagged_expire_days" {
  description = "untagged image を削除するまでの日数"
  type        = number
  default     = 14
}

# --- ローカル開発専用 Cognito ---------------------------------------------

variable "cognito_local_callback_urls" {
  description = <<-EOT
    ローカル開発専用 Cognito App Client の Callback URL。
    ローカル Vite（http://localhost:5173/）のみ。CloudFront / dev 環境の URL は含めない。
  EOT
  type        = list(string)
  default     = ["http://localhost:5173/"]
}

variable "cognito_local_logout_urls" {
  description = <<-EOT
    ローカル開発専用 Cognito App Client の Logout URL。
    ローカル Vite（http://localhost:5173/）のみ。CloudFront / dev 環境の URL は含めない。
  EOT
  type        = list(string)
  default     = ["http://localhost:5173/"]
}
