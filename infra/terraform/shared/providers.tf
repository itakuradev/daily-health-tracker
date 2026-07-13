# AWS Provider 設定。
#
# 認証情報はコードに書かない。`aws login` の一時認証情報等、実行環境から解決させる。
provider "aws" {
  region = var.aws_region

  # 全リソースへ共通タグを自動付与する。
  # shared は環境をまたいで保持する層のため、Environment タグは "shared" とする。
  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
