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
