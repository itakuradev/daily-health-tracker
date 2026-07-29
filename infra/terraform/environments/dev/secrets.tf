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
  #
  # RDS はデフォルトで SSL 必須（rds.force_ssl=1）のため、非 SSL 接続は拒否される
  # （Prisma P1010: no encryption）。アプリ側を SSL 接続にするため sslmode を付与する。
  #
  # sslmode=no-verify を採用する:
  #   - TLS で通信は暗号化される（rejectUnauthorized=false でも TLS ハンドシェイクは行う）。
  #   - サーバー証明書の厳密な検証（CA チェーン・ホスト名）は省略する dev 向け設定。
  #   - 現在の pg-connection-string 2.13.0 では sslmode=require は verify-full 相当の
  #     完全検証になり、RDS の CA バンドルを明示しない限り検証に失敗しやすい。
  #     no-verify は CA 管理なしで確実に暗号化接続でき、今回の目的（暗号化）を満たす。
  #   - 本番相当環境では、RDS CA を配布して sslmode=verify-full による CA 検証を検討する。
  #
  # クエリパラメータは他に無いため "?" で付与する。
  database_url = format(
    "postgresql://%s:%s@%s:%d/%s?sslmode=no-verify",
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
