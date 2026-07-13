# ==========================================================================
# Secrets Manager
#
# DATABASE_URL を保存し、ECS Task Definition から secrets 経由で注入する。
# Secret 値そのものは output しない。
# ==========================================================================

locals {
  # PostgreSQL 接続文字列。
  # パスワードは unreserved 文字のみで生成しているため URL エンコード不要
  # （database.tf の random_password.db を参照）。
  database_url = format(
    "postgresql://%s:%s@%s:%d/%s",
    var.db_username,
    random_password.db.result,
    aws_db_instance.main.address,
    aws_db_instance.main.port,
    var.db_name,
  )
}

resource "aws_secretsmanager_secret" "database_url" {
  name        = "${var.project}/${var.environment}/backend/database-url"
  description = "PostgreSQL DATABASE_URL for backend (dev)"

  # dev では即時削除できるようにする（既定 30 日の復旧待機を無効化）。
  # これにより destroy 直後に同名 Secret を再作成でき、日次の作り直しが詰まらない。
  recovery_window_in_days = 0

  tags = {
    Application = "backend"
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}
