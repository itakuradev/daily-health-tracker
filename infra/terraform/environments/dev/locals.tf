# ==========================================================================
# ローカル値
# ==========================================================================

locals {
  # リソース名の接頭辞: <project>-<environment> = daily-health-tracker-dev
  name_prefix = "${var.project}-${var.environment}"

  # 全リソース共通タグ（provider の default_tags で自動付与される）。
  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # 利用する AZ（data.tf のコメント参照。apne1-az3 を除いた先頭 2 つ）。
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}
