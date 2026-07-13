# shared — 環境をまたいで保持する永続リソース

`environments/dev` を毎日 `terraform destroy` / `apply` で作り直しても**残しておきたい**リソースを管理する root module。
現時点では **ECR Repository** のみを管理する。

## なぜ dev から分けるのか

ECR を `environments/dev` に置くと、`terraform destroy`（dev）が ECR も削除対象に含めてしまう。

- push 済み image があると destroy がエラーで止まる、または
- `force_delete` で image ごと消える

いずれも「image は残したいが dev は毎日作り直す」運用に噛み合わない。
そこで ECR を **別 state（`shared/terraform.tfstate`）の shared 層**へ分離し、dev の destroy が ECR に触れないようにする。
`environments/dev` からは `data "aws_ecr_repository"` で**参照のみ**する。

## このディレクトリの tf ファイルは 1 つの root module

同一ディレクトリ内の全 `.tf` を 1 つの root module としてまとめて評価する（ファイル分割は可読性のため）。

## 管理するもの

- `aws_ecr_repository.backend`（既存 `daily-health-tracker-backend` を import）
  - `force_delete = false`（image 保護）
  - `lifecycle { prevent_destroy = true }`（誤破棄防止）
  - scan on push 有効
- `aws_ecr_lifecycle_policy.backend`（untagged は N 日で削除 / tag 付きは直近 20 件保持）

## 前提

- Terraform 1.10 以降
- AWS 認証は実行環境から解決（コード・backend.hcl に鍵を書かない）
- bootstrap を apply 済みで、state 用 S3 Bucket 名が分かっていること

## 実行手順

```powershell
Set-Location infra/terraform/shared
Copy-Item backend.hcl.example backend.hcl
# backend.hcl の bucket を bootstrap の output 値に書き換える（key は shared/terraform.tfstate）

terraform init -backend-config=backend.hcl
terraform plan     # 既存 ECR が import 予定として表示される
terraform apply    # ← レビュー後に人間が実行する
```

### import について

`ecr.tf` に import block を記述済みのため、`terraform import` コマンドは不要。
`plan` で「import 予定」表示 → `apply` で state（`shared/terraform.tfstate`）へ取り込まれる。

## destroy / 保護

- `prevent_destroy = true` のため、`terraform destroy` や置換は既定でエラー停止する。
- どうしても削除する場合は、`ecr.tf` の当該 `lifecycle` ブロックを一時的に外してから destroy する。
- `force_delete = false` のため、image が残っている限りバケットは削除されない（多層の保護）。

## 全体の実行順序

```text
1. bootstrap        … state 用 S3 Bucket を作成
2. shared           … 既存 ECR を import（このモジュール）
3. environments/dev … Stage 1 + Cognito（ECR は data source で参照）
```
