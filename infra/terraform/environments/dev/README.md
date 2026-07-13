# environments/dev — Stage 1 + Cognito

`docs/11-aws-architecture.md` の **Stage 1（バックエンド最小構成）+ Cognito** を Terraform で構築する root module。

## このディレクトリの tf ファイルは 1 つの root module

`network.tf` / `security.tf` / `ecr.tf` … と機能ごとにファイルを分けているが、
Terraform は **同一ディレクトリ内の全 `.tf` を 1 つの root module としてまとめて評価**する。
ファイル間で `aws_vpc.main` のようにリソースを直接参照でき、分割は可読性のためだけのもの。
実行単位（`init` / `plan` / `apply` の対象）はこのディレクトリ全体である。

## 構築されるもの

- **Network**: VPC(10.0.0.0/16) / Public Application Subnet x2 / Private DB Subnet x2 / IGW / Route Table（NAT・EIP なし）
- **Security Group**: ALB / ECS / RDS（独立 rule resource で定義、SG 間参照）
- **ECR（参照のみ）**: 本体は `shared` root module が管理。ここでは `data "aws_ecr_repository"` で名前から参照するだけ（dev destroy で ECR を消さない）
- **RDS**: PostgreSQL 16 / db.t4g.micro / Single-AZ / 非公開 / 暗号化
- **Secrets Manager**: `daily-health-tracker/dev/backend/database-url`
- **IAM**: ECS Task Execution Role / ECS Task Role（分離）
- **CloudWatch Logs**: `/ecs/daily-health-tracker-dev-backend`（保持 7 日）
- **ALB**: internet-facing / HTTP:80 / Target Group(ip:3000, health `/api/health`)
- **ECS**: Fargate Cluster / Task Definition / Service（desired 1, circuit breaker + rollback）
- **Cognito**: User Pool / SPA App Client / Managed Login Domain

## AZ の選び方

`data.aws_availability_zones.available` で利用可能な AZ を取得し、
**`apne1-az3` を除外**した先頭 2 つを使う（`data.tf` 参照）。
理由: Stage 2 で導入予定の CloudFront VPC Origin が `apne1-az3` に非対応のため、
将来 Private Origin Subnet を追加する際に Application/DB Subnet と AZ を揃えられるようにしておく。
（Private Origin Subnet 自体は今回まだ作成しない。）

---

## 実行順序（bootstrap → shared → dev）

全体の実行順は 3 段階。dev はこの 3 番目。

```text
1. bootstrap        … state 用 S3 Bucket を作成
2. shared           … 既存 ECR を import（infra/terraform/shared）
3. environments/dev … このモジュール
```

### 0. 前提

- Terraform 1.10 以降
- AWS 認証は `aws login` 等で実行環境に用意（コード・backend.hcl に鍵を書かない）
- bootstrap を先に apply 済みで、state Bucket 名が分かっていること
- **shared を先に apply 済みで、ECR Repository が存在すること**
  （dev は `data "aws_ecr_repository"` で ECR を参照するため、無いと plan がエラーになる）

### 1. backend.hcl を用意

Windows PowerShell:

```powershell
Set-Location infra/terraform/environments/dev
Copy-Item backend.hcl.example backend.hcl
# backend.hcl の bucket を bootstrap の output 値に書き換える
```

macOS / Linux:

```bash
cd infra/terraform/environments/dev
cp backend.hcl.example backend.hcl
```

`backend.hcl` は **コミットしない**（`.gitignore` 済み）。

### 2. init（S3 backend を構成）

```bash
terraform init -backend-config=backend.hcl
```

S3 backend では `encrypt = true` / `use_lockfile = true` を使用（DynamoDB は不要）。

### 3. plan / apply

```bash
terraform plan     # ← 内容確認
terraform apply    # ← レビュー後に人間が実行する
```

---

## ECR の扱い（このモジュールでは参照のみ）

ECR Repository 本体・Lifecycle Policy・import は **`shared` root module** で管理する（[../../shared/README.md](../../shared/README.md)）。
dev はこの ECR を `data "aws_ecr_repository" "backend"` で名前から**参照するだけ**。

これにより:

- dev の `terraform destroy` は ECR を削除対象に含めない（destroy が ECR エラーで止まらない）。
- ECR Repository と push 済み image は、dev を作り直しても保持される。

前提として、**dev の前に shared を apply して ECR が存在している**必要がある（無いと data source 参照で plan がエラー）。

---

## plan 時に確認すべき項目

- ECR が **data source 参照**であり、create/destroy 対象に**入っていない**こと
- 新規 **作成（create）** されるリソース一覧に想定外がないか
- **削除（destroy）/ 置換（replace）** が出ていないか（初回はすべて create のはず）
- RDS の `password` や Secret 値が **plan 差分に平文表示されていないか**（sensitive 扱い）
- Subnet が異なる 2 AZ に割り当たっているか
- Cognito domain prefix に Account ID suffix が付いているか

---

## apply 後の疎通確認

ALB 経由でヘルスチェック（200 と `{"status":"ok"}` を確認）。

Windows PowerShell（`curl` は Invoke-WebRequest の別名のため、実バイナリの `curl.exe` を使う）:

```powershell
$alb = terraform output -raw alb_dns_name
curl.exe -i "http://$alb/api/health"
```

macOS / Linux:

```bash
curl -i "http://$(terraform output -raw alb_dns_name)/api/health"
```

- ECS Service の Task が 1 個 Running か（マネジメントコンソール / `aws ecs describe-services`）
- ALB Target Group の Target が **healthy** か
- CloudWatch Logs `/ecs/daily-health-tracker-dev-backend` にアプリログが出ているか
- 初回起動時に `npx prisma migrate deploy` が成功しているか（ログで確認）

---

## 初回 seed（one-off task）の実行手順

通常起動コマンドには seed を含めない。初回だけ one-off task で 1 回実行する。
必要な ID（Cluster / TaskDef / Subnet / ECS SG）はすべて `terraform output` から取得できる。
**以下は例であり、実際にはまだ実行しない。**

Windows PowerShell:

```powershell
$cluster = terraform output -raw ecs_cluster_name
$taskdef = terraform output -raw ecs_task_definition_family
$sg      = terraform output -raw ecs_security_group_id
# public_app_subnet_ids は list output。先頭の Subnet を取り出す
$subnet  = (terraform output -json public_app_subnet_ids | ConvertFrom-Json)[0]

aws ecs run-task `
  --cluster $cluster `
  --task-definition $taskdef `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$subnet],securityGroups=[$sg],assignPublicIp=ENABLED}" `
  --overrides '{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"node\",\"dist/prisma/seed.js\"]}]}'
```

macOS / Linux:

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
TASKDEF=$(terraform output -raw ecs_task_definition_family)
SG=$(terraform output -raw ecs_security_group_id)
SUBNET=$(terraform output -json public_app_subnet_ids | jq -r '.[0]')

aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASKDEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["node","dist/prisma/seed.js"]}]}'
```

> Dockerfile の seed は `tsx prisma/seed.ts` を前提とする定義もあるため、実際の seed 実行方法は
> backend のビルド成果物（`dist/` に seed が含まれるか）に合わせて確定すること。

---

## Cognito 初期ユーザー作成手順

実ユーザーは Terraform で作らない。管理者が手動作成する。

Windows PowerShell:

```powershell
$pool = terraform output -raw cognito_user_pool_id

# ユーザー作成（招待メールを抑止する場合は --message-action SUPPRESS）
aws cognito-idp admin-create-user `
  --user-pool-id $pool `
  --username "user@example.com" `
  --user-attributes Name=email,Value=user@example.com Name=email_verified,Value=true `
  --message-action SUPPRESS

# 恒久パスワードを設定
aws cognito-idp admin-set-user-password `
  --user-pool-id $pool `
  --username "user@example.com" `
  --password "<STRONG_PASSWORD>" `
  --permanent
```

macOS / Linux:

```bash
POOL_ID=$(terraform output -raw cognito_user_pool_id)

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "user@example.com" \
  --user-attributes Name=email,Value=user@example.com Name=email_verified,Value=true \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "user@example.com" \
  --password '<STRONG_PASSWORD>' \
  --permanent
```

マネジメントコンソール（Cognito → User Pool → Users → Create user）からでも可。
ログイン画面は Managed Login（`cognito_hosted_ui_domain` の URL）を使う。

---

## Cognito 実装側（別スレッド）へ渡す output

現在の backend コードには Cognito 系の環境変数が **まだ存在しない**ため、アプリコードは変更していない。
下記は **推奨名と値**。採用名は実装側で確定する。

| 推奨環境変数名 | 取得元 output |
| --- | --- |
| `COGNITO_USER_POOL_ID` | `cognito_user_pool_id` |
| `COGNITO_CLIENT_ID` | `cognito_app_client_id` |
| `COGNITO_ISSUER` | `cognito_issuer_url` |
| `COGNITO_USERINFO_URL` | `cognito_userinfo_endpoint` |
| `COGNITO_REGION` | （`aws_region`） |

その他 output: `cognito_hosted_ui_domain` / `cognito_authorization_endpoint` / `cognito_token_endpoint`。
まとめて `terraform output cognito_backend_env_suggestion` でも取得できる。

> Client Secret は発行しない（public SPA client）。ユーザー情報・Secret 値は output しない。

---

## Terraform state に含まれうる機密情報

**state（S3 の `dev/terraform.tfstate`）には次が平文で保存されうる。**

- RDS マスターパスワード（`random_password.db.result`）
- `DATABASE_URL` 全文（Secrets Manager の値）
- RDS エンドポイント

そのため:

- state 用 S3 Bucket の **暗号化・Versioning・Block Public Access** が重要（bootstrap で設定済み）。
- state ファイルをローカルに保存・共有・コミットしない。
- `terraform output` や `terraform show` で機密が表示されうる点に注意（sensitive 指定はしているが state 自体には残る）。

---

## 継続課金が発生するリソース

- **RDS** インスタンス（stop しても一定費用、gp3 ストレージ課金）
- **ALB**（起動している限り時間課金。停止不可）
- **NAT Gateway は無し**（コスト回避）
- ECS Fargate（Task 稼働時間ぶん。desired 0 で止められる）
- CloudWatch Logs（保存量）/ Secrets Manager（Secret 1 件）/ S3 state（僅少）
- Cognito は無料枠内なら実質無料

長期中断時: ECS `desired_count = 0`、必要なら ALB / RDS の削除を検討（`docs/11` 28.1 参照）。

### ECS Task を止める / 戻す（destroy せずに Fargate 稼働費だけ抑える）

`ecs_desired_count` 変数で Task 数を制御する。`0` にすると Task が停止し、Fargate 稼働費が止まる
（ALB / RDS は残るため、それらの課金は続く点に注意）。

Windows PowerShell:

```powershell
# Task を止める
terraform apply -var="ecs_desired_count=0"

# Task を戻す（既定は 1）
terraform apply -var="ecs_desired_count=1"
```

---

## terraform destroy で削除されるもの / 残るもの

`terraform destroy`（dev）で削除:

- VPC / Subnet / IGW / Route Table / Security Group
- RDS（`skip_final_snapshot = true` のため最終スナップショットなしで削除）
- Secrets Manager Secret / IAM Role / CloudWatch Log Group
- ALB / Target Group / Listener
- ECS Cluster / Service / Task Definition
- Cognito User Pool / App Client / Domain（**登録済みユーザーも消える**）

> **ECR は dev の destroy 対象外**（shared 管理・data source 参照のため）。Repository も image も残る。

destroy 後も残るもの:

- **ECR Repository と push 済み image**（`shared` root module 管理。dev destroy では触れない）
- **bootstrap の state 用 S3 Bucket**（別 root module。dev destroy では消えない）
- AWS Budget（Terraform 管理外）
- ローカルの `backend.hcl` 等の作業ファイル

---

## 未実装（Stage 2 以降）

NAT Gateway / VPC Endpoint / Private Origin Subnet / internal ALB / CloudFront VPC Origin /
S3 frontend / CloudFront Distribution / GitHub Actions / GitHub OIDC / ecspresso /
Route 53 / ACM / WAF / Datadog / Sentry / Multi-AZ / Auto Scaling / Fargate Spot。
