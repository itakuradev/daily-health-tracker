# Terraform / Provider のバージョン制約。
#
# - import block（既存 ECR の取り込み）は Terraform 1.5 以降で利用可能
# - S3 backend native locking（use_lockfile）は Terraform 1.10 以降
# を利用するため、required_version を 1.10 以上に固定する。
terraform {
  required_version = ">= 1.10.0, < 2.0.0"

  required_providers {
    # Cognito Managed Login（managed_login_version / managed_login_branding /
    # user_pool_tier）を使うため 6.12.0 以上を要求する。
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.12.0, < 7.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0, < 4.0.0"
    }
  }
}
