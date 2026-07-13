# AWS Provider 設定。
#
# 認証情報はコードに書かない。`aws login` の一時認証情報や AWS_PROFILE 等、
# 実行環境（環境変数・共有 config）から解決させる。
provider "aws" {
  region = var.aws_region

  # 全リソースへ共通タグを自動付与する。
  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
