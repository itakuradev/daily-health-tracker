# ==========================================================================
# ECR（参照のみ）
#
# ECR Repository 本体・Lifecycle Policy は shared root module（infra/terraform/shared）で
# 管理する。dev の terraform destroy で ECR を削除しないよう、ここでは data source で
# 名前から参照するだけにする。
#
# 前提: shared を先に apply して既存 Repository を import 済みであること
#       （存在しない Repository を参照すると plan がエラーになる）。
# ==========================================================================

data "aws_ecr_repository" "backend" {
  name = var.ecr_repository_name
}
