# ==========================================================================
# data source
#
# Account ID や Partition はハードコードせず、必ず data source から取得する。
# ==========================================================================

# 実行中の AWS アカウント情報（Account ID の取得に使用）。
data "aws_caller_identity" "current" {}

# パーティション（aws / aws-cn / aws-us-gov）。IAM 管理ポリシー ARN 等の組み立てに使用する。
data "aws_partition" "current" {}

# 利用可能な Availability Zone。
#
# CloudFront VPC Origin（Stage 2 で導入予定）は東京リージョンのうち
# AZ ID `apne1-az3` に非対応である。将来 Private Origin Subnet を追加する際に
# Application/DB Subnet と AZ を揃えられるよう、Stage 1 の時点から
# `apne1-az3` を除外した AZ 集合の先頭 2 つを選ぶ。
#
# これにより「後から VPC Origin 用 Subnet だけ別 AZ になってしまう」事故を防ぐ。
data "aws_availability_zones" "available" {
  state            = "available"
  exclude_zone_ids = ["apne1-az3"]
}

# CloudFront が origin へ接続する際の送信元 IP レンジ（AWS 管理 prefix list）。
# internal ALB の Security Group inbound をこの prefix list に限定し、
# 自己流の広い CIDR 許可を避ける（公式手順 Option 1）。
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}
