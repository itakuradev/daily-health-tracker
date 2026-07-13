# infra/terraform

daily-health-tracker の AWS インフラを Terraform で管理する。
今回の実装範囲は `docs/11-aws-architecture.md` の **Stage 1 + Cognito**。

## ディレクトリ構成

```text
infra/terraform/
  bootstrap/            # Terraform remote state 用 S3 Bucket を作る（ローカル state）
  shared/               # 環境をまたいで保持する永続リソース（ECR）。S3 backend: shared/terraform.tfstate
  environments/
    dev/                # Stage 1 + Cognito 本体。S3 backend: dev/terraform.tfstate
```

初期段階では `modules/` を作らず、機能別 `.tf` を置くフラット構成とする。
**同一ディレクトリ内の `.tf` は 1 つの root module** として評価される（分割は可読性のためだけ）。

3 つの root module は**別々の state**を持つ。`bootstrap` はローカル state、
`shared` と `dev` は同じ S3 Bucket 内の**別 key**（`shared/terraform.tfstate` / `dev/terraform.tfstate`）を使う。

### なぜ shared を分けるか

`environments/dev` は検証のたびに `destroy` / `apply` で作り直す想定。
ECR（Repository と push 済み image）は作り直し後も残したいので、dev の destroy 対象に含めないよう
別 root module（shared）へ分離する。dev からは `data "aws_ecr_repository"` で参照するだけ。

## 使い方（概要 / 実行順）

```text
1. bootstrap        … state 用 S3 Bucket を作成
2. shared           … 既存 ECR を import
3. environments/dev … Stage 1 + Cognito（ECR は data source 参照）
```

1. `bootstrap/` を apply → [bootstrap/README.md](bootstrap/README.md)
2. `shared/` を `terraform init -backend-config=backend.hcl` して apply → [shared/README.md](shared/README.md)
3. `environments/dev/` を `terraform init -backend-config=backend.hcl` して apply → [environments/dev/README.md](environments/dev/README.md)

詳細な実行順・ECR import・疎通確認・seed・Cognito ユーザー作成・destroy 挙動・
state に含まれる機密情報・継続課金は、各 README を参照。

## 認証・機密の扱い

- AWS 認証情報（Access Key / Secret / Session Token）や Account ID を **コードに書かない**。
  Account ID・Partition は data source から取得する。
- DB パスワードは `random_password` で生成し、コード・tfvars・Git に平文保存しない。
- ただし **パスワードや DATABASE_URL は Terraform state に保存されうる**。
  state 用 S3 Bucket の暗号化・Versioning・Block Public Access が重要（bootstrap で設定）。
