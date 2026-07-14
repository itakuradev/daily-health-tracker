# ==========================================================================
# Bootstrap: Terraform remote state 用の S3 Bucket を作成する。
#
# この bootstrap 自体は「ローカル state」で動作する（backend 設定を持たない）。
# ここで作った S3 Bucket は、shared と environments/dev の両方が S3 backend として利用する
# （同じ Bucket 内で key を分ける: shared/terraform.tfstate と dev/terraform.tfstate）。
#
# S3 backend native locking（use_lockfile = true）を使うため、
# DynamoDB Lock Table は作成しない。
# ==========================================================================

# --- 入力変数（bootstrap では variables.tf を作らず main.tf にまとめる） -----

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
  description = "環境名。state Bucket は環境横断で共有するため主にタグ用途"
  type        = string
  default     = "shared"
}

# --- data source（Account ID をハードコードせず取得する） --------------------

data "aws_caller_identity" "current" {}

locals {
  # S3 Bucket 名は全世界で一意である必要があるため Account ID を suffix に付ける。
  state_bucket_name = "${var.project}-tfstate-${data.aws_caller_identity.current.account_id}"
}

# --- Terraform state 用 S3 Bucket ------------------------------------------

resource "aws_s3_bucket" "tfstate" {
  bucket = local.state_bucket_name

  # state を保管する土台。誤った destroy / 置換を止める。
  # 破棄が必要なときは、この lifecycle ブロックを一時的に外してから destroy する。
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = local.state_bucket_name
  }
}

# バージョニング: state の履歴を残し、破損・誤更新から復旧できるようにする。
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

# サーバーサイド暗号化: state には DB パスワードや DATABASE_URL が含まれうるため必須。
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    # bucket_key_enabled は SSE-KMS 向けの最適化。SSE-S3(AES256) では無意味なため設定しない。
  }
}

# Public Access を全面ブロックする（state を絶対に公開しない）。
resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# TLS(HTTPS) 以外のアクセスを拒否する（AWS Foundational Security Best Practices S3.5 相当）。
# state には DB パスワードや DATABASE_URL が含まれうるため、非TLSアクセスを明示的に塞ぐ。
# Deny + aws:SecureTransport=false は「非TLS のときだけ拒否」であり、正規の HTTPS アクセスには影響しない。
resource "aws_s3_bucket_policy" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.tfstate.arn,
          "${aws_s3_bucket.tfstate.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
    ]
  })

  # Public Access Block の設定完了後にポリシーを適用する
  # （block_public_policy が有効な状態でのポリシー評価順を安定させる）。
  depends_on = [aws_s3_bucket_public_access_block.tfstate]
}
