# S3 remote state backend。
#
# bootstrap で作った state 用 S3 Bucket を利用する。
# 設定値（bucket / key / region 等）は backend.hcl から与える:
#   terraform init -backend-config=backend.hcl
#
# key は shared/terraform.tfstate（dev/terraform.tfstate とは別 state）。
# 認証情報は backend.tf にも backend.hcl にも書かない。
terraform {
  backend "s3" {}
}
