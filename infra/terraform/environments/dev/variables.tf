# ==========================================================================
# 入力変数
#
# 実値（tfvars）はコミットしない。terraform.tfvars.example を参考に、
# 必要なら terraform.tfvars を作成する。既定値のままでも動作する。
# ==========================================================================

variable "aws_region" {
  description = "リソースを作成する AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project" {
  description = "プロジェクト名。リソース名・タグの接頭辞に使用する"
  type        = string
  default     = "daily-health-tracker"
}

variable "environment" {
  description = "環境名"
  type        = string
  default     = "dev"
}

# --- Network --------------------------------------------------------------

variable "vpc_cidr" {
  description = "VPC の CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_app_subnet_cidrs" {
  description = "Public Application Subnet の CIDR（2 つ、異なる AZ に配置）"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_db_subnet_cidrs" {
  description = "Private DB Subnet の CIDR（2 つ、異なる AZ に配置）"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "private_origin_subnet_cidrs" {
  description = <<-EOT
    CloudFront VPC Origin 用の internal ALB を配置する Private Origin Subnet の CIDR
    （2 つ、異なる AZ）。IGW へのルートを持たない private subnet に配置する。
  EOT
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24"]
}

# --- ECR ------------------------------------------------------------------

variable "ecr_repository_name" {
  description = "参照する ECR Repository 名（本体は shared root module が管理）"
  type        = string
  default     = "daily-health-tracker-backend"
}

# --- Container image ------------------------------------------------------

variable "image_tag" {
  description = "ECS Task Definition で使用する backend image の tag（latest のみに依存しない）"
  type        = string
  default     = "aws-0"
}

# --- Database -------------------------------------------------------------

variable "db_engine_version" {
  description = "RDS PostgreSQL の major version"
  type        = string
  default     = "16"
}

variable "db_instance_class" {
  description = "RDS のインスタンスクラス（最小の burstable を第一候補とする）"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "初期作成するデータベース名"
  type        = string
  default     = "health_tracker"
}

variable "db_username" {
  description = "RDS マスターユーザー名"
  type        = string
  default     = "dht_admin"
}

variable "db_allocated_storage" {
  description = "RDS の割り当てストレージ（GiB）"
  type        = number
  default     = 20
}

# --- ECS backend container 環境変数 ---------------------------------------

variable "container_cpu" {
  description = "Fargate Task の CPU（units）"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "Fargate Task のメモリ（MiB）"
  type        = number
  default     = 512
}

variable "container_port" {
  description = "backend コンテナが待ち受けるポート"
  type        = number
  default     = 3000
}

variable "ecs_desired_count" {
  description = "ECS Service で維持する Task 数（0 にすると Task を止められる）"
  type        = number
  default     = 1

  validation {
    condition     = var.ecs_desired_count >= 0
    error_message = "ecs_desired_count は 0 以上で指定してください。"
  }
}

variable "cors_origin" {
  description = "backend の CORS 許可 origin（カンマ区切り）"
  type        = string
  default     = "http://localhost:5173,http://localhost:5174"
}

variable "enable_swagger" {
  description = "backend の Swagger 公開可否（AWS 上では false）"
  type        = string
  default     = "false"
}

# --- Cognito --------------------------------------------------------------

variable "cognito_callback_urls" {
  description = <<-EOT
    Cognito App Client の Callback URL。
    Stage 1 はローカル Vite のみ。将来 CloudFront 導入時にこのリストへ追加する。
  EOT
  type        = list(string)
  default     = ["http://localhost:5173/"]
}

variable "cognito_logout_urls" {
  description = <<-EOT
    Cognito App Client の Logout URL。
    Stage 1 はローカル Vite のみ。将来 CloudFront 導入時にこのリストへ追加する。
  EOT
  type        = list(string)
  default     = ["http://localhost:5173/"]
}
