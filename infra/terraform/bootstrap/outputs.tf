# bootstrap の出力。
# ここで得た値を environments/dev/backend.hcl に転記して `terraform init` する。

output "state_bucket_name" {
  description = "Terraform remote state 用 S3 Bucket 名（backend.hcl の bucket に設定する）"
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_region" {
  description = "state Bucket のリージョン（backend.hcl の region に設定する）"
  value       = var.aws_region
}

output "shared_backend_hcl_hint" {
  description = "shared の backend.hcl に転記する内容のヒント（key = shared/terraform.tfstate）"
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.tfstate.bucket}"
    key          = "shared/terraform.tfstate"
    region       = "${var.aws_region}"
    encrypt      = true
    use_lockfile = true
  EOT
}

output "dev_backend_hcl_hint" {
  description = "environments/dev の backend.hcl に転記する内容のヒント（key = dev/terraform.tfstate）"
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.tfstate.bucket}"
    key          = "dev/terraform.tfstate"
    region       = "${var.aws_region}"
    encrypt      = true
    use_lockfile = true
  EOT
}
