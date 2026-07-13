# ==========================================================================
# ALB（Stage 1: internet-facing）
#
#   Internet ─80─▶ ALB Listener ─▶ Target Group(ip:3000) ─▶ ECS Task ENI
#
# Target Group / Listener は ECS Service より先に必要（ecs.tf の depends_on 参照）。
# ==========================================================================

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public_app[*].id

  tags = {
    Name        = "${local.name_prefix}-alb"
    Application = "backend"
  }
}

# target_type = ip: Fargate（awsvpc）の Task ENI を直接ターゲット登録する。
resource "aws_lb_target_group" "backend" {
  name        = "${local.name_prefix}-backend-tg"
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
