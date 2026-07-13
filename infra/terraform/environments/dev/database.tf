# ==========================================================================
# RDS PostgreSQL
#
# パスワードは random_password で生成する。コード・tfvars・Git へ平文保存しない。
# ただし生成値・DATABASE_URL は Terraform state に保存されうる（README 参照）。
# ==========================================================================

# DATABASE_URL に埋め込んだ際 URL エンコードが不要な文字だけで生成する。
# 使用する記号を RFC3986 unreserved（- _ . ~）に限定し、@ : / ? # 等の予約文字を避ける。
resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "-_.~"
  # 各種文字を最低 1 文字含める（RDS のパスワード要件を満たしやすくする）。
  min_lower   = 1
  min_upper   = 1
  min_numeric = 1
  min_special = 1
}

# DB Subnet Group には Private DB Subnet x2 のみを指定する。
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private_db[*].id

  tags = {
    Name        = "${local.name_prefix}-db-subnet-group"
    Application = "database"
  }
}

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-db" # daily-health-tracker-dev-db

  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 5432

  # ストレージ
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 0 # storage autoscaling 無効
  storage_type          = "gp3"
  storage_encrypted     = true

  # ネットワーク / アクセス
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  # バックアップ / 監視
  backup_retention_period      = 1
  monitoring_interval          = 0 # Enhanced Monitoring 無効
  performance_insights_enabled = false

  # dev 向け: 削除保護なし・最終スナップショットなしで削除可能
  deletion_protection = false
  skip_final_snapshot = true
  apply_immediately   = true

  tags = {
    Name        = "${local.name_prefix}-db"
    Application = "database"
  }
}
