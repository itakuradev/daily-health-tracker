# ==========================================================================
# ネットワーク
#
#   VPC 10.0.0.0/16
#   ├── Public Application Subnet A / C  (10.0.1.0/24, 10.0.2.0/24)
#   │     → 0.0.0.0/0 は Internet Gateway 経由
#   └── Private DB Subnet A / C          (10.0.11.0/24, 10.0.12.0/24)
#         → Internet Gateway へのデフォルトルートを持たない
#
# NAT Gateway / Elastic IP は作成しない（コスト優先。ECS は public IP で外向き通信）。
# ==========================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

# --- Public Application Subnet x2 -----------------------------------------

resource "aws_subnet" "public_app" {
  count = length(var.public_app_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_app_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  # Subnet 既定での public IP 自動付与は無効化する。
  # ECS Task の public IP は ECS Service 側の assign_public_ip = true で個別に付与する
  #（ALB は public IP 不要。将来 public IP を持つべきものだけを明示的に制御する）。
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-public-app-${local.azs[count.index]}"
    Tier = "public-application"
  }
}

# --- Private DB Subnet x2 -------------------------------------------------

resource "aws_subnet" "private_db" {
  count = length(var.private_db_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_db_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${local.name_prefix}-private-db-${local.azs[count.index]}"
    Tier = "private-database"
  }
}

# --- Private Origin Subnet x2（CloudFront VPC Origin 用 internal ALB）-------
#
# CloudFront VPC Origin は origin（internal ALB）を private subnet に置くことを要件とする。
# CloudFront が service-managed ENI をこの subnet に作成し、private 接続する。
# IGW へのデフォルトルートは持たせない（インターネットから ALB へ直接到達させない）。
# AZ は data.aws_availability_zones で apne1-az3 を除外済みのため VPC Origin 要件に適合する。

resource "aws_subnet" "private_origin" {
  count = length(var.private_origin_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_origin_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${local.name_prefix}-private-origin-${local.azs[count.index]}"
    Tier = "private-origin"
  }
}

# --- Public Route Table（0.0.0.0/0 → IGW） --------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public_app" {
  count = length(aws_subnet.public_app)

  subnet_id      = aws_subnet.public_app[count.index].id
  route_table_id = aws_route_table.public.id
}

# --- Private DB Route Table（外部へのデフォルトルートなし） -----------------

resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.main.id

  # 0.0.0.0/0 ルートを持たない。VPC 内ローカルルートのみ。

  tags = {
    Name = "${local.name_prefix}-private-db-rt"
  }
}

resource "aws_route_table_association" "private_db" {
  count = length(aws_subnet.private_db)

  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private_db.id
}

# --- Private Origin Route Table（外部へのデフォルトルートなし） --------------

resource "aws_route_table" "private_origin" {
  vpc_id = aws_vpc.main.id

  # 0.0.0.0/0 ルートを持たない。VPC 内ローカルルートのみ。
  # （CloudFront VPC Origin は private 接続のため、subnet に IGW ルートは不要。）

  tags = {
    Name = "${local.name_prefix}-private-origin-rt"
  }
}

resource "aws_route_table_association" "private_origin" {
  count = length(aws_subnet.private_origin)

  subnet_id      = aws_subnet.private_origin[count.index].id
  route_table_id = aws_route_table.private_origin.id
}
