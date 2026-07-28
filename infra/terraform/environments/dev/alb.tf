# ==========================================================================
# ALB（Stage 2: internal / CloudFront VPC Origin 経由）
#
#   CloudFront ─(VPC Origin)─80─▶ internal ALB Listener ─▶ Target Group(ip:3000)
#                                                          ─▶ ECS Task ENI
#
# internal = true とし、Private Origin Subnet に配置する。
# インターネットから ALB へ直接到達させず、CloudFront を単一の入口にする。
# Target Group / Listener は ECS Service より先に必要（ecs.tf の depends_on 参照）。
# ==========================================================================

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  load_balancer_type = "application"
  internal           = true
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.private_origin[*].id

  tags = {
    Name        = "${local.name_prefix}-alb"
    Application = "backend"
  }
}

# target_type = ip: Fargate（awsvpc）の Task ENI を直接ターゲット登録する。
# Target Group 名は最大 32 文字。"${local.name_prefix}-backend-tg" だと
# daily-health-tracker-dev-backend-tg = 35 文字で超過するため、短縮形 dht- を使う。
resource "aws_lb_target_group" "backend" {
  name        = "dht-${var.environment}-backend-tg"
  target_type = "ip"
  protocol    = "HTTP"
  port        = var.container_port
  vpc_id      = aws_vpc.main.id

  health_check {
    protocol            = "HTTP"
    path                = "/api/health"
    port                = "traffic-port"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${local.name_prefix}-backend-tg"
    Application = "backend"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  tags = {
    Application = "backend"
  }
}
