# ==========================================================================
# ローカル値（shared）
# ==========================================================================

locals {
  # ローカル開発専用 Cognito のリソース名接頭辞。
  # dev 用（daily-health-tracker-dev-...）と衝突しないよう "local" を明示的に含める。
  #   → daily-health-tracker-local
  cognito_name_prefix = "${var.project}-local"
}
