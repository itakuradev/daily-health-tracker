# AWS Provider 設定。
#
# 認証情報はコードに書かない。`aws login` の一時認証情報や AWS_PROFILE 等、
# 実行環境から解決させる（backend.tf・backend.hcl にも認証情報は書かない）。
provider "aws" {
  region = var.aws_region

  # 全リソースへ共通タグを自動付与する。個別リソースの tags と自動でマージされる。
  default_tags {
    tags = local.common_tags
  }
}

# random provider は設定不要（DB パスワード生成に使用）。
provider "random" {}
