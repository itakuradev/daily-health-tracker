# bootstrap — Terraform remote state 用 S3 Bucket の作成

このディレクトリは、`shared` と `environments/dev` の両方が使う **Terraform remote state 用の S3 Bucket** を作成する。
両者は同じ Bucket 内で **key を分けて** state を保存する（`shared/terraform.tfstate` / `dev/terraform.tfstate`）。

- bootstrap 自身は **ローカル state** で動作する（`backend` 設定を持たない）。
- 作成する S3 Bucket には次を設定する:
  - Versioning 有効
  - サーバーサイド暗号化（SSE-S3 / AES256）
  - Public Access 全ブロック
  - TLS(HTTPS) 以外のアクセスを拒否（`aws:SecureTransport=false` を Deny。AWS FSBP S3.5 相当）
- **DynamoDB Lock Table は作成しない**。ロックは S3 backend の native locking（`use_lockfile = true`）を使う。

## このディレクトリの tf ファイルは 1 つの root module

`versions.tf` / `providers.tf` / `main.tf` / `outputs.tf` は分割されているが、
Terraform は **同一ディレクトリ内の全 `.tf` を 1 つの root module としてまとめて評価**する。
ファイル分割は人間が読みやすくするためだけのもので、実行単位はディレクトリである。

## 前提

- Terraform 1.10 以降（`use_lockfile` を dev で使うため）
- AWS 認証は `aws login` の一時認証情報等、実行環境から解決（コードに鍵を書かない）
- リージョン: `ap-northeast-1`

## 実行手順

```bash
cd infra/terraform/bootstrap

terraform init
terraform validate
terraform plan
terraform apply    # ← レビュー後に人間が実行する
```

apply 後、出力された `state_bucket_name` を控える。

```bash
terraform output
```

この値を `shared/backend.hcl` と `environments/dev/backend.hcl` の `bucket` に転記する。
それぞれの `backend.hcl` に転記する内容は、次の output でそのまま確認できる。

```bash
terraform output shared_backend_hcl_hint   # shared 用（key = shared/terraform.tfstate）
terraform output dev_backend_hcl_hint      # dev 用（key = dev/terraform.tfstate）
```

## 実行順序（全体）

```text
1. bootstrap        … このモジュール（state 用 S3 Bucket を作成）
2. shared           … 既存 ECR を import
3. environments/dev … Stage 1 + Cognito
```

## 注意

- bootstrap のローカル state ファイル（`terraform.tfstate`）は Git にコミットしない（`.gitignore` 済み）。
- state Bucket 自体を Terraform で破棄すると shared / dev の state が失われる。運用上は作りっぱなしにする。
- state Bucket には `lifecycle { prevent_destroy = true }` を設定している。
  そのため `terraform destroy` や置換（bucket 名変更など）は既定で **エラーで停止**する。
  どうしても削除したい場合は、`main.tf` の当該 `lifecycle` ブロックを一時的に外してから
  `terraform destroy` を実行する（削除後は元に戻す）。
