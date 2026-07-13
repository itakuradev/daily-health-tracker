# ==========================================================================
# ECR（shared 層）
#
# ECR は環境をまたいで保持する成果物置き場のため、毎日作り直す environments/dev
# ではなく、この shared root module で管理する。
# これにより dev の terraform destroy で ECR が削除されず、image も保持される。
#
# 既存の Repository（daily-health-tracker-backend）を新規作成せず import する。
# Terraform 1.5+ の import block を使うため、事前の `terraform import` コマンドは不要。
# ==========================================================================

import {
  to = aws_ecr_repository.backend
  id = var.ecr_repository_name
}

resource "aws_ecr_repository" "backend" {
  name = var.ecr_repository_name

  # 既存リポジトリは可変タグ（latest / aws-0）を運用しているため MUTABLE を維持する。
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # push 済み image を保護する。空でない限り削除しない（既定どおり）。
  force_delete = false

  # Repository（と image）を誤って destroy / 置換しないよう保護する。
  # 破棄が必要なときは、この lifecycle ブロックを一時的に外してから destroy する。
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = var.ecr_repository_name
    Application = "backend"
  }
}

# Lifecycle Policy:
#   1) untagged image は一定期間後に削除
#   2) tag 付き image は直近 20 件を保持（超過分を削除）
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after ${var.ecr_untagged_expire_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.ecr_untagged_expire_days
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the last 20 tagged images"
        selection = {
          # tag 付き image のみを対象に、直近 20 件を超えた分を削除する。
          # tagStatus = "tagged" では tagPrefixList か tagPatternList が必須。
          # 全 tag を対象にするため tagPatternList = ["*"] を指定する。
          tagStatus      = "tagged"
          tagPatternList = ["*"]
          countType      = "imageCountMoreThan"
          countNumber    = 20
        }
        action = { type = "expire" }
      },
    ]
  })
}
