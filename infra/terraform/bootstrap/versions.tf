# Terraform / Provider のバージョン制約。
#
# use_lockfile による S3 backend native locking（DynamoDB 不要のロック）は
# Terraform 1.10 以降で利用できるため、required_version を 1.10 以上に固定する。
terraform {
  required_version = ">= 1.10.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.12.0, < 7.0.0"
    }
  }
}
