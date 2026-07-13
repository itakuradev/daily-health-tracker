# ==========================================================================
# IAM
#
# ECS Task Execution Role と ECS Task Role を別々に作成する。
#   - Execution Role : ECS エージェントが Task を起動するために使う
#                      （ECR pull / Logs 書き込み / Secrets 取得）
#   - Task Role      : コンテナ内アプリが AWS API を呼ぶ場合に使う
#                      （現時点でアプリは AWS API を直接呼ばないため権限なし）
# ==========================================================================

# 両 Role 共通の信頼ポリシー（ECS タスクが assume する）。
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- ECS Task Execution Role ----------------------------------------------

resource "aws_iam_role" "ecs_execution" {
  name               = "${local.name_prefix}-ecs-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Application = "backend"
  }
}

# AWS 管理ポリシー: ECR pull と CloudWatch Logs 書き込みの標準権限。
resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# 追加 inline policy: 対象 Secret の取得だけを許可（ARN で限定）。
data "aws_iam_policy_document" "ecs_execution_secrets" {
  statement {
    sid       = "ReadDatabaseUrlSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.database_url.arn]
  }
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name   = "read-database-url-secret"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution_secrets.json
}

# --- ECS Task Role（追加権限なし） ----------------------------------------

resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_prefix}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = {
    Application = "backend"
  }
}
