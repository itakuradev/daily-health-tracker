# S3 remote state backend。
#
# 設定値（bucket / key / region 等）はここに書かず、backend.hcl から与える:
#   terraform init -backend-config=backend.hcl
#
# 認証情報は backend.tf にも backend.hcl にも書かない（実行環境から解決させる）。
terraform {
  backend "s3" {}
}
