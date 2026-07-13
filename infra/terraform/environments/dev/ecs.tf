# ==========================================================================
# ECS Fargate
#
# Cluster / Task Definition / Service を Terraform で管理する（ecspresso は未導入）。
#
# コンテナ起動コマンドは Dockerfile の CMD をそのまま利用する:
#   npx prisma migrate deploy && node dist/src/main.js
# → 初回 Task 起動時に migration が適用される。seed は含めない（README の one-off 手順参照）。
# ==========================================================================

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  # Container Insights は無効。
  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Application = "backend"
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.container_cpu
  memory                   = var.container_memory

  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${data.aws_ecr_repository.backend.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        },
      ]

      # 通常の環境変数（機密でないもの）。Cognito 系の変数はアプリ側に未実装のため
      # ここでは注入せず、Terraform output と README で推奨名のみ提示する。
      environment = [
        { name = "PORT", value = tostring(var.container_port) },
        { name = "NODE_ENV", value = "production" },
        { name = "ENABLE_SWAGGER", value = var.enable_swagger },
        { name = "CORS_ORIGIN", value = var.cors_origin },
      ]

      # 機密値は Secrets Manager から注入する（平文の環境変数にしない）。
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    },
  ])

  tags = {
    Application = "backend"
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${local.name_prefix}-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  # 起動直後の migration 実行を考慮し、ALB ヘルスチェックの猶予を設ける。
  health_check_grace_period_seconds = 120

  # apply を Service が安定（steady state）するまで待たせ、失敗を早期に検知する。
  wait_for_steady_state = true

  # デプロイ設定
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.public_app[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true # NAT を使わないため public IP で外向き通信する
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.container_port
  }

  # Service が正常起動するために先に整っている必要があるもの:
  #   - Listener（と Target Group）: ALB 登録先
  #   - Secret Version: DATABASE_URL の実値（未投入だと Task 起動が失敗する）
  #   - Execution Role のポリシー: ECR pull / Logs / Secret 取得の権限
  depends_on = [
    aws_lb_listener.http,
    aws_secretsmanager_secret_version.database_url,
    aws_iam_role_policy_attachment.ecs_execution_managed,
    aws_iam_role_policy.ecs_execution_secrets,
  ]

  tags = {
    Application = "backend"
  }
}
