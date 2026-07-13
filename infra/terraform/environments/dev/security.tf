# ==========================================================================
# Security Group
#
# ルールは inline ではなく、独立した rule resource
# （aws_vpc_security_group_ingress_rule / _egress_rule）で定義する。
# inline rule（aws_security_group の ingress/egress ブロック）とは混在させない。
#
# SG 間の参照は referenced_security_group_id を使う。
# CIDR 許可（cidr_ipv4）と SG 参照を混同しないこと。
#
#   Internet ──80──▶ [ALB SG] ──3000──▶ [ECS SG] ──5432──▶ [RDS SG]
#                                          └──443──▶ 0.0.0.0/0（ECR/Logs/Secrets/Cognito）
# ==========================================================================

# --- SG 本体（ルールは下で別リソースとして付与） --------------------------

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "ALB. Inbound HTTP from internet, outbound to ECS."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-alb-sg"
    Application = "backend"
  }
}

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "ECS tasks. Inbound only from ALB, outbound to RDS and HTTPS."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-ecs-sg"
    Application = "backend"
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "RDS. Inbound PostgreSQL only from ECS."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-rds-sg"
    Application = "database"
  }
}

# --- ALB SG rules ---------------------------------------------------------

# Inbound: TCP 80 from 0.0.0.0/0（internet-facing）
resource "aws_vpc_security_group_ingress_rule" "alb_http_in" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from internet"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

# Outbound: TCP 3000 to ECS SG
resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to ECS container port"
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
  referenced_security_group_id = aws_security_group.ecs.id
}

# --- ECS SG rules ---------------------------------------------------------

# Inbound: TCP 3000 from ALB SG のみ
resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "Container port from ALB only"
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
  referenced_security_group_id = aws_security_group.alb.id
}

# Outbound: TCP 5432 to RDS SG
resource "aws_vpc_security_group_egress_rule" "ecs_to_rds" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "PostgreSQL to RDS"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.rds.id
}

# Outbound: TCP 443 to 0.0.0.0/0（ECR / CloudWatch Logs / Secrets Manager / Cognito UserInfo）
resource "aws_vpc_security_group_egress_rule" "ecs_https_out" {
  security_group_id = aws_security_group.ecs.id
  description       = "HTTPS to AWS APIs and Cognito"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

# --- RDS SG rules ---------------------------------------------------------

# Inbound: TCP 5432 from ECS SG のみ
resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  description                  = "PostgreSQL from ECS only"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.ecs.id
}
