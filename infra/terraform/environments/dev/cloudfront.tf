# ==========================================================================
# CloudFront Distribution（HTTPS 標準ドメインでの配信）
#
#   Viewer ─HTTPS─▶ CloudFront 標準ドメイン
#     ├─ default（S3 / OAC）        … React SPA（HTML/JS/CSS/画像）
#     └─ /api/*（VPC Origin → ALB） … NestJS API
#
# - Viewer の HTTP は HTTPS へリダイレクトする。
# - 独自ドメイン・ACM は使わず、CloudFront 標準証明書を使う。
# - /api/* はキャッシュ無効、Authorization / Query / 本文を origin へ転送する。
# - SPA の直接アクセス（/daily 等）は default behavior のみで index.html へ書き換える。
#   /api/* には適用しないため、API の 403/404 が SPA へ変換されることはない。
# ==========================================================================

# --- AWS 管理ポリシー（独自ポリシーを増やさない） -------------------------

# S3 静的配信向けの標準キャッシュポリシー。
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# API 向け：キャッシュを完全に無効化する。
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# API 向け：Host 以外の全 viewer ヘッダー（Authorization 含む）・Query・Cookie を
# origin へ転送する。Host は CloudFront が origin（ALB DNS）に設定するため、
# internal ALB への接続を壊さない。
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# --- SPA ルーティング用 CloudFront Function（viewer request） --------------
#
# 拡張子を持たないパス（/daily, /history, / など）を index.html へ書き換え、
# React Router の直接アクセスを成立させる。拡張子付き（/assets/x.js 等）は書き換えない。
# この Function は default behavior（S3）にのみ関連付け、/api/* には付けない。
resource "aws_cloudfront_function" "spa_router" {
  name    = "${local.name_prefix}-spa-router"
  runtime = "cloudfront-js-2.0"
  comment = "SPA routing for S3 default behavior only (does not touch /api/*)"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri.endsWith('/')) {
        request.uri = '/index.html';
      } else if (!uri.includes('.')) {
        request.uri = '/index.html';
      }
      return request;
    }
  EOT
}

# --- CloudFront VPC Origin（internal ALB） ---------------------------------
#
# CloudFront から internal ALB へ private 接続する。ALB Listener は HTTP:80 のため
# origin_protocol_policy = http-only。origin_ssl_protocols は schema 上必須のため指定する
# （http-only では実際の TLS ネゴシエーションには使われない）。
resource "aws_cloudfront_vpc_origin" "alb" {
  vpc_origin_endpoint_config {
    name                   = "${local.name_prefix}-alb-origin"
    arn                    = aws_lb.main.arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "http-only"

    origin_ssl_protocols {
      items    = ["TLSv1.2"]
      quantity = 1
    }
  }

  tags = {
    Name        = "${local.name_prefix}-alb-origin"
    Application = "backend"
  }
}

# --- Distribution ---------------------------------------------------------

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  comment             = "${local.name_prefix} SPA + API"
  default_root_object = "index.html"
  price_class         = "PriceClass_200" # 北米・欧州・アジア（東京含む）。全エッジより安価。

  # Origin 1: S3（OAC）
  origin {
    origin_id                = "s3-frontend"
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: internal ALB（VPC Origin）
  origin {
    origin_id   = "alb-api"
    domain_name = aws_lb.main.dns_name

    vpc_origin_config {
      vpc_origin_id = aws_cloudfront_vpc_origin.alb.id
    }
  }

  # default behavior: React SPA（S3）
  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    # SPA ルーティングは S3 default behavior にのみ適用する。
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  # /api/* behavior: NestJS API（internal ALB / VPC Origin）
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "alb-api"
    viewer_protocol_policy = "redirect-to-https"

    # API で使うメソッドを許可する（PUT/PATCH も含め標準的にまとめて許可）。
    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods  = ["GET", "HEAD"]
    compress        = false

    # キャッシュ無効 + Host 以外の全ヘッダー/Query/Cookie 転送（Authorization 含む）。
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

    # SPA ルーティング Function は付けない（API の 403/404/5xx を index.html へ変換しない）。
  }

  # 標準証明書（*.cloudfront.net）を使う。独自ドメイン・ACM は使わない。
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name        = "${local.name_prefix}-cloudfront"
    Application = "frontend"
  }
}
