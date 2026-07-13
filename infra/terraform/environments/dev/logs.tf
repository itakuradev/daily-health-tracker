# ==========================================================================
# CloudWatch Logs
#
# backend コンテナ用の Log Group。ECS Task Definition の awslogs driver から使用する。
# ==========================================================================

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}-backend"
  retention_in_days = 7

  tags = {
    Application = "backend"
  }
}
