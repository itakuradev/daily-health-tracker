# ==========================================================================
# フロントエンド配信用 S3（非公開。CloudFront OAC からのみ読み取り可能）
#
#   CloudFront ─(OAC / SigV4)─▶ S3（React SPA の build 成果物）
#
# - Block Public Access を全有効化し、バケットを公開しない。
# - ACL に依存しない（Object Ownership = BucketOwnerEnforced で ACL 無効化）。
# - S3 website endpoint は使わず、CloudFront の通常 S3 origin として使う。
# - GetObject は CloudFront Distribution（AWS:SourceArn 条件）のみに許可する。
# - build 成果物（dist）は Terraform では管理せず、AWS CLI で sync する。
# - dev は日次 destroy 前提のため force_destroy = true（成果物が残っていても削除可能）。
# ==========================================================================

resource "aws_s3_bucket" "frontend" {
  # バケット名は全世界で一意。Account ID を suffix にして衝突を避ける（機密ではない）。
  bucket = "${local.name_prefix}-frontend-${data.aws_caller_identity.current.account_id}"

  # dev の日次 destroy を成立させる（build 成果物が残っていても destroy 可能にする）。
  force_destroy = true

  tags = {
    Name        = "${local.name_prefix}-frontend"
    Application = "frontend"
  }
}

# 公開を全面的にブロックする。
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ACL を無効化し、所有権をバケット所有者に固定する（ACL に依存しない）。
resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# CloudFront Origin Access Control（OAC / SigV4）。
# OAI ではなく OAC を使い、S3 origin へ署名付きでアクセスする。
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name_prefix}-frontend-oac"
  description                       = "OAC for frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution（この後 cloudfront.tf で定義）からのみ GetObject を許可する。
# バケットポリシーは Distribution の ARN で制限する（他からの GetObject は不可）。
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })

  # Public Access Block を先に適用してからバケットポリシーを付与する。
  depends_on = [aws_s3_bucket_public_access_block.frontend]
}
