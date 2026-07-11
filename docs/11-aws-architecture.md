# 健康管理マスター AWSアーキテクチャ設計書 v0.2

## 1. ドキュメントの目的

本ドキュメントは、健康管理マスターをAWS上で稼働させるためのアーキテクチャ方針を定義する資料である。

本ドキュメントでは、以下を整理する。

* AWS全体構成
* 段階的なAWS構築方針
* ネットワーク構成
* フロントエンド配信構成
* バックエンド実行構成
* データベース構成
* Cognito認証構成
* IAM設計
* Secrets管理
* ログ・監視
* CI/CD
* ECSデプロイ方式
* Prisma migration
* Terraform化
* コスト抑制方針

本書では、AWS構築を次の2段階に分ける。

```text
Stage 1:
バックエンド最小構成

Stage 2:
完成形
```

Stage 1はAWSサービス間の接続関係を理解するための一時構成とする。

Stage 2を、本アプリケーションの完成形として扱う。

---

## 2. 設計の基本方針

AWS構成では、以下を基本方針とする。

* 実務で利用される構成・運用方法を取り入れる
* 個人開発として維持可能な費用に抑える
* 最初から過度な高可用性構成にはしない
* 認証・DB・機密情報を適切に分離する
* AWSリソース間のアクセスをSecurity Groupで制限する
* 長期的なAWSアクセスキーを使用しない
* ECSデプロイにはGitHub Actionsとecspressoを利用する
* インフラは最終的にTerraformで管理する
* 独自ドメインは取得しない
* フロントエンドとAPIはCloudFrontの標準ドメインから配信する
* 初期構成ではコストを優先し、Multi-AZや自動スケーリングは採用しない

---

## 3. 対象環境

初期構築では、開発・学習用の1環境のみを作成する。

```text
Environment:
dev

AWS Region:
ap-northeast-1
```

初期段階では、以下の環境は作成しない。

* staging
* production
* disaster recovery環境

将来的に複数環境を作成する場合は、リソース名、Terraform state、Cognito User Pool、RDSを環境ごとに分離する。

---

## 4. 段階的構築方針

## 4.1 Stage 1：バックエンド最小構成

Stage 1では、Docker化済みのNestJSバックエンドをECS Fargateへ配置し、RDS PostgreSQLと接続する。

フロントエンドはローカルVite開発サーバーから利用する。

```text
ローカルPC
├── React + Vite
└── ブラウザ
      ↓ HTTP
internet-facing ALB
      ↓
ECS Fargate
      ↓
RDS PostgreSQL
```

Stage 1の目的は以下。

* ECRへDocker imageを保存できること
* ECS FargateでNestJSを起動できること
* ALBからECSへ接続できること
* ALBヘルスチェックが成功すること
* ECSからRDSへ接続できること
* Secrets ManagerからDATABASE_URLを取得できること
* CloudWatch Logsへログを出力できること

Stage 1では、まず以下を確認する。

```http
GET /api/health
```

```json
{
  "status": "ok"
}
```

Stage 1はHTTPを使用する一時構成である。

そのため、Stage 1では実際の健康情報や機微な個人データを登録せず、ダミーデータのみを利用する。

## 4.2 Stage 2：完成形

Stage 2では、フロントエンド、認証、HTTPS、APIを含む完成形を構築する。

```text
Internet
   ↓ HTTPS
CloudFront
├── /*      → S3 private bucket
│
└── /api/* → CloudFront VPC Origin
                   ↓
              internal ALB（Private Origin Subnet）
                   ↓ private IP
              ECS Fargate（Public Application Subnet）
                   ↓
              RDS PostgreSQL（Private DB Subnet）
```

Stage 2でもECS Taskは当面Public Application Subnetに残し、internal ALBのみを新設のPrivate Origin Subnetへ配置する。

ALBはターゲットへprivate IPで通信するため、ECSが別Subnetにあっても接続できる。

認証にはCognito User PoolとCognito Hosted UIを利用する。

```text
Browser
  ↓
Cognito Hosted UI
  ↓ Authorization Code + PKCE
React SPA
  ↓ Authorization: Bearer <access_token>
CloudFront /api/*
  ↓
ALB
  ↓
ECS
```

---

## 5. Stage 1 AWS構成

## 5.1 構成概要

```text
AWS
├── ECR
│   └── Backend Docker image
│
├── VPC
│   ├── Public Application Subnet A
│   │   ├── internet-facing ALB
│   │   └── ECS Fargate Task
│   │
│   ├── Public Application Subnet C
│   │   ├── internet-facing ALB
│   │   └── ECS Fargate Task配置可能
│   │
│   ├── Private DB Subnet A
│   │   └── RDS配置候補
│   │
│   └── Private DB Subnet C
│       └── RDS配置候補
│
├── ECS
│   ├── Cluster
│   ├── Service
│   ├── Task Definition
│   └── Task
│
├── ALB
│   ├── Listener
│   ├── Target Group
│   └── Health Check
│
├── RDS for PostgreSQL
│
├── Secrets Manager
│   └── DATABASE_URL
│
├── IAM
│   ├── ECS Task Execution Role
│   └── ECS Task Role
│
└── CloudWatch Logs
    └── Backend container logs
```

## 5.2 Stage 1の通信経路

```text
Internet
↓
ALB Security Group
↓ TCP 3000
ECS Security Group
↓ TCP 5432
RDS Security Group
```

ECS Taskにはpublic IPを付与する。

ただし、ECSのコンテナポートへのInbound通信は、ALB Security Groupからのみ許可する。

インターネットからECS Taskへ直接アクセスできる構成にはしない。

---

## 6. Stage 2 AWS構成

## 6.1 構成概要

```text
AWS
├── CloudFront
│   ├── Default Behavior /*
│   │   └── S3 Origin
│   │
│   └── Ordered Behavior /api/*
│       └── VPC Origin
│           └── internal ALB
│
├── S3
│   └── Frontend build files
│
├── Cognito
│   ├── User Pool
│   ├── App Client
│   └── Hosted UI
│
├── ECR
│   └── Backend Docker image
│
├── VPC
│   ├── Public Application Subnet A / C
│   │   └── ECS Fargate Task（public IPあり）
│   │
│   ├── Private Origin Subnet A / C
│   │   ├── internal ALB
│   │   └── CloudFront VPC Origin用ENI
│   │
│   └── Private DB Subnet A / C
│       └── RDS PostgreSQL
│
├── ECS
│   ├── Cluster
│   ├── Service
│   ├── Task Definition
│   └── Task
│
├── Secrets Manager
├── CloudWatch Logs
├── IAM
└── GitHub Actions OIDC Provider / Role
```

## 6.2 完成形の公開範囲

完成形では、インターネットへ直接公開する入口をCloudFrontに集約する。

```text
公開:
CloudFront

直接公開しない:
S3
ALB
RDS
```

ECS Taskは、Public Application Subnetに配置するためpublic IPを持つ。

ただし、ECS Security GroupのInboundをALB Security Groupからのみに限定し、インターネットからECS Taskへの直接アクセスは拒否する。

```text
ECS:
public IPは存在するが、
Security GroupによりALBからの通信のみ許可し、
インターネットからの直接アクセスは拒否する。
```

ブラウザは以下のCloudFront標準ドメインへアクセスする。

```text
https://xxxxxxxxxxxx.cloudfront.net
```

独自ドメインは取得しない。

---

## 7. ネットワーク設計

## 7.1 VPC

VPCは健康管理マスター専用に作成する。

例：

```text
VPC CIDR:
10.0.0.0/16
```

## 7.2 Subnet

異なるAvailability Zoneに、Application SubnetとDB Subnetを作成する。

### Stage 1

例：

| Subnet                   | CIDR例          | 用途      |
| ------------------------ | -------------- | ------- |
| Public Application Subnet A | `10.0.1.0/24`  | ALB、ECS |
| Public Application Subnet C | `10.0.2.0/24`  | ALB、ECS |
| Private DB Subnet A      | `10.0.11.0/24` | RDS     |
| Private DB Subnet C      | `10.0.12.0/24` | RDS     |

### Stage 2

Stage 2では、CloudFront VPC Originで使うinternal ALB専用に、Private Origin Subnetを2つ追加する。

例：

| Subnet                      | CIDR例          | 用途                          |
| --------------------------- | -------------- | --------------------------- |
| Public Application Subnet A | `10.0.1.0/24`  | ECS Fargate Task            |
| Public Application Subnet C | `10.0.2.0/24`  | ECS Fargate Task            |
| Private Origin Subnet A     | `10.0.21.0/24` | internal ALB、VPC Origin ENI |
| Private Origin Subnet C     | `10.0.22.0/24` | internal ALB、VPC Origin ENI |
| Private DB Subnet A         | `10.0.11.0/24` | RDS                         |
| Private DB Subnet C         | `10.0.12.0/24` | RDS                         |

Private Origin SubnetとPrivate DB Subnetには、Internet Gatewayへのデフォルトルートを設定しない。

利用するAvailability Zoneは、構築時点で利用可能な2つを選択する。

特定のAZ名へ固定しすぎず、Terraform化時には変数として扱う。

ただし、CloudFront VPC Originは東京リージョンに対応しているが、AZ ID `apne1-az3` は対象外である。Private Origin Subnetを配置するAZは、VPC Originが対応するAZ IDから選択する。

## 7.3 Internet Gateway

VPCへInternet Gatewayを接続する。

Application Subnetでは、以下のルートを設定する。

```text
0.0.0.0/0
→ Internet Gateway
```

Stage 1では、ALBをinternet-facingとして使用する。

ECS Taskは、ECR、CloudWatch Logs、Secrets Manager等へアクセスするためpublic IPを持つ。

## 7.4 DB Subnet

DB Subnetには、Internet Gatewayへのデフォルトルートを設定しない。

RDSはpublic accessを無効にする。

```text
Publicly Accessible:
false
```

## 7.5 NAT Gateway

初期構成ではNAT Gatewayを使用しない。

理由：

* 個人開発では固定費の影響が大きい
* Stage 1ではECS Taskへpublic IPを付与することで、AWS APIやECRへ接続できる
* Security GroupによりInbound通信をALBからのみに制限できる

この判断は、コストを優先したものである。

企業向け高可用性構成では、ECS Taskをprivate subnetへ配置し、NAT GatewayまたはVPC Endpointを使用する構成を検討する。

---

## 8. Security Group設計

## 8.1 ALB Security Group

### Stage 1

Inbound：

| Protocol | Port | Source      |
| -------- | ---: | ----------- |
| TCP      |   80 | `0.0.0.0/0` |

Outbound：

| Protocol | Port | Destination        |
| -------- | ---: | ------------------ |
| TCP      | 3000 | ECS Security Group |

### Stage 2

Stage 2では、Stage 1のinternet-facing ALBのschemeを変更するのではなく、Private Origin Subnetにinternal ALBを新規作成して置き換える（詳細は「12.1 ALB Scheme」を参照）。

internal ALBは、CloudFront VPC Originからの通信のみを受け付ける。

CloudFront VPC Originを作成すると、AWS管理のSecurity Group `CloudFront-VPCOrigins-Service-SG` が作られる。internal ALBのSecurity Groupでは、このSecurity GroupからのHTTP通信のみを許可する。

Inbound：

| Protocol | Port | Source                            |
| -------- | ---: | --------------------------------- |
| TCP      |   80 | `CloudFront-VPCOrigins-Service-SG` |

Outbound：

| Protocol | Port | Destination        |
| -------- | ---: | ------------------ |
| TCP      | 3000 | ECS Security Group |

CloudFront managed prefix listを使う方法もあるが、service-managed Security Groupの方が対象を絞れる。

## 8.2 ECS Security Group

Inbound：

| Protocol | Port | Source             |
| -------- | ---: | ------------------ |
| TCP      | 3000 | ALB Security Group |

Outbound：

| Protocol | Port | Destination        |
| -------- | ---: | ------------------ |
| TCP      | 5432 | RDS Security Group |
| TCP      |  443 | `0.0.0.0/0`        |

TCP 443（`0.0.0.0/0`）は、ECR、CloudWatch Logs、Secrets Manager、Cognito UserInfo等への外向きHTTPS通信に使用する。Security Groupの宛先には「AWSサービス」のような名称は指定できないため、初期構成では `0.0.0.0/0` を用いる。

初期実装では、Outboundを一度すべて許可したうえで疎通確認し、必要な通信が整理できた段階で制限する方法も許容する。

将来ECSをprivate subnetへ移した場合は、外向きHTTPS通信のために、NAT Gateway、またはECR・CloudWatch Logs・Secrets Manager等のVPC Endpointが必要になる。

## 8.3 RDS Security Group

Inbound：

| Protocol | Port | Source             |
| -------- | ---: | ------------------ |
| TCP      | 5432 | ECS Security Group |

RDSへのアクセス元として、IPアドレスや `0.0.0.0/0` を指定しない。

---

## 9. ECR設計

## 9.1 Repository

Backend用のECR Repositoryを作成する。

```text
daily-health-tracker-backend
```

## 9.2 Image Tag

通常デプロイでは、`latest` のみに依存しない。

Gitのcommit SHAをDocker image tagとして利用する。

例：

```text
daily-health-tracker-backend:a1b2c3d4
```

必要に応じて、補助的に以下のtagを付与する。

```text
latest
dev
```

ECS Task Definitionでは、原則としてcommit SHA付きのimageを指定する。

## 9.3 Image Scan

ECRでは、push時のimage scanを有効にする。

```text
scanOnPush:
true
```

## 9.4 Lifecycle Policy

古いimageが増え続けないように、将来的にLifecycle Policyを設定する。

例：

* 直近20個のtag付きimageを保持
* untagged imageを一定期間後に削除

---

## 10. ECS設計

## 10.1 ECS Cluster

ECS Cluster名の例：

```text
daily-health-tracker-dev-cluster
```

起動方式はFargateとする。

## 10.2 ECS Service

ECS Serviceは、Backend Taskを常時1個維持する。

```text
desiredCount:
1
```

初期構成ではAuto Scalingを利用しない。

## 10.3 Task Definition

初期リソースサイズは、Fargateで選択可能な最小構成とする。

```text
CPU:
0.25 vCPU

Memory:
0.5 GB
```

NestJS、Prisma、Node.jsの起動時または実行中にメモリ不足が発生した場合は、次の構成へ変更する。

```text
CPU:
0.25 vCPU

Memory:
1 GB
```

Container Port：

```text
3000
```

## 10.4 Fargate Capacity

初期実装ではFargate On-Demandを利用する。

Fargate Spotは利用しない。

理由：

* Taskが中断される可能性がある
* desiredCountが1の場合、中断がサービス停止へ直結する
* 初期段階では安定した動作確認を優先する

## 10.5 Public IP

NAT Gatewayを使用しないため、ECS Taskにはpublic IPを付与する。

```text
Assign Public IP:
Enabled
```

ただし、ECS Security GroupのInboundはALB Security Groupからのみに限定する。

---

## 11. ECS Rolling Deployment

## 11.1 デプロイ方式

ECS Serviceのデプロイ方式にはRolling updateを採用する。

```text
旧Task
↓
新Taskを起動
↓
ALBヘルスチェック
↓
新TaskがHealthy
↓
旧Taskを停止
```

## 11.2 Deployment Configuration

初期設定は以下とする。

```text
minimumHealthyPercent:
100

maximumPercent:
200
```

`desiredCount = 1` の場合、デプロイ中は一時的に以下の状態になる。

```text
旧Task:
1

新Task:
1

一時的な合計:
2
```

新Taskが正常になってから旧Taskを停止することで、停止時間を抑える。

## 11.3 Deployment Circuit Breaker

ECS Deployment Circuit Breakerを有効にする。

```text
Deployment Circuit Breaker:
Enabled

Automatic Rollback:
Enabled
```

新Taskが起動できない、またはALBヘルスチェックに成功しない場合は、直前の正常なデプロイへ戻す。

## 11.4 Blue/Greenを採用しない理由

初期実装ではBlue/Green Deploymentを採用しない。

理由：

* 小規模な個人開発である
* 追加のTarget GroupやCodeDeploy設定が必要になる
* Rolling updateで必要な可用性を確保できる
* 構成・運用コストを抑えられる

---

## 12. ALB設計

## 12.1 ALB Scheme

Stage 1：

```text
internet-facing
```

Stage 2：

```text
internal
```

ALBのschemeは作成時に `internet-facing` または `internal` を選択するものであり、後から変更できない。IaC上でもscheme変更はreplacement扱いとなる。

そのため、Stage 2ではStage 1のinternet-facing ALBをそのまま切り替えるのではなく、Private Origin Subnetにinternal ALBを新規作成する。

```text
1. Private Origin Subnetにinternal ALBを新規作成
2. CloudFront VPC Originをinternal ALBへ向ける
3. CloudFront経由の疎通確認
4. Stage 1のinternet-facing ALBを削除
```

Stage 2ではCloudFront VPC Originからinternal ALBへ接続する。

## 12.2 Listener

### Stage 1

```text
Protocol:
HTTP

Port:
80
```

Stage 1では独自ドメインと証明書を使用しないため、ALB単体のHTTPS Listenerは作成しない。

### Stage 2

ブラウザからCloudFrontまではHTTPSとする。

CloudFrontからinternal ALBまでは、VPC内のHTTP通信を利用する。

独自ドメインを取得しないため、ALBへ公開ACM証明書を設定する構成は採用しない。

## 12.3 Target Group

```text
Target Type:
IP

Protocol:
HTTP

Port:
3000
```

Fargate TaskのENIをTargetとして登録する。

## 12.4 Health Check

```text
Protocol:
HTTP

Path:
/api/health

Port:
traffic port

Success Codes:
200
```

`/api/health` は、ALBがNestJSプロセスの起動状態を確認するための軽量なendpointとする。

DB接続まで含めたReadiness Checkが必要になった場合は、将来的に別endpointを検討する。

例：

```text
/api/health
/api/ready
```

---

## 13. RDS PostgreSQL設計

## 13.1 Database Engine

```text
Amazon RDS for PostgreSQL
```

PostgreSQLのmajor versionは、Prismaとアプリケーションが対応している範囲で、構築時点の安定版を選択する。

## 13.2 Instance Class

構築時点で東京リージョンから選択可能な、最小のburstable instanceを使用する。

候補例：

```text
db.t4g.micro
```

ただし、利用可能なinstance classは構築時に確認する。

## 13.3 Availability

```text
Multi-AZ:
Disabled

Deployment:
Single-AZ
```

初期構成では高可用性よりコストを優先する。

## 13.4 Storage

```text
Storage Type:
General Purpose SSD

Storage Size:
選択可能な最小容量
```

Storage Auto Scalingは初期実装では無効とする。

## 13.5 Public Access

```text
Publicly Accessible:
false
```

RDSへはECS Taskからのみ接続する。

## 13.6 Encryption

RDSの保存データ暗号化を有効にする。

## 13.7 Backup

自動バックアップ保持期間は短めに設定する。

初期値の例：

```text
Backup Retention:
1 day
```

個人開発であり、長期間のPoint-in-Time Recoveryは初期要件としない。

## 13.8 Monitoring

初期実装では以下を無効とする。

* Multi-AZ
* Read Replica
* Enhanced Monitoring

通常のCloudWatch Metricsは利用する。

DB性能分析については、RDS Performance Insightsのコンソール体験が2026年7月31日に終了し、CloudWatch Database Insightsへ移行する予定である。そのため、本書ではCloudWatch Database Insightsとして扱う。

```text
CloudWatch Database Insights:
初期はStandard相当のみ
Advanced modeは無効
```

---

## 14. DB Subnet Group

RDS用にDB Subnet Groupを作成する。

DB Subnet Groupには、異なるAvailability ZoneのPrivate DB Subnetを2つ以上指定する。

```text
Private DB Subnet A
Private DB Subnet C
```

RDSがSingle-AZであっても、DB Subnet Group自体は複数AZのSubnetで構成する。

---

## 15. Secrets Manager設計

## 15.1 管理対象

以下の機密情報をSecrets Managerで管理する。

```text
DATABASE_URL
```

Secret名の例：

```text
daily-health-tracker/dev/backend/database-url
```

値の例：

```text
postgresql://<user>:<password>@<rds-endpoint>:5432/<database>
```

## 15.2 ECSへの注入

ECS Task DefinitionのSecrets設定から、コンテナ環境変数として注入する。

```text
DATABASE_URL
← Secrets Manager
```

ソースコード、Docker image、GitHub Repository、通常のTask Definition環境変数へ平文で保存しない。

## 15.3 Secret更新時

Secrets Managerの値を更新しても、既に起動しているTaskの環境変数は自動更新されない。

Secret更新後は、新しいECS Taskをデプロイする。

---

## 16. ECS IAM Role設計

## 16.1 Task Execution Role

Task Execution Roleは、ECSがTaskを起動するために使用する。

主な権限：

* ECRからimageをpullする
* CloudWatch Logsへログを送る
* Secrets ManagerからSecretを取得する

追加権限の例：

```text
secretsmanager:GetSecretValue
```

対象Secretを限定する。

## 16.2 Task Role

Task Roleは、実行中のNestJSアプリケーションがAWS APIへアクセスする場合に使用する。

初期実装では、NestJSアプリケーションからAWS APIを直接呼ばない場合、Task Roleには追加権限を付与しない。

```text
Task Role:
最小権限
```

## 16.3 Roleの分離

Task Execution RoleとTask Roleは別Roleとして管理する。

```text
Task Execution Role:
ECSによるTask起動処理

Task Role:
コンテナ内アプリケーションのAWS操作
```

---

## 17. Backend環境変数

ECS Task Definitionへ以下を設定する。

| 環境変数                  | 設定値例           | 管理方法            |
| --------------------- | -------------- | --------------- |
| `PORT`                | `3000`         | 通常環境変数          |
| `NODE_ENV`            | `production`   | 通常環境変数          |
| `ENABLE_SWAGGER`      | `false`        | 通常環境変数          |
| `CORS_ORIGIN`         | 環境ごとのURL       | 通常環境変数          |
| `DATABASE_URL`        | PostgreSQL URL | Secrets Manager |
| Cognito User Pool ID  | 構築値            | 通常環境変数          |
| Cognito App Client ID | 構築値            | 通常環境変数          |
| Cognito Issuer        | 構築値            | 通常環境変数          |
| Cognito UserInfo URL  | 構築値            | 通常環境変数          |

## 17.1 Stage 1 CORS

Stage 1では、ローカルViteのoriginを許可する。

例：

```text
http://localhost:5173
http://localhost:5174
```

## 17.2 Stage 2 CORS

Stage 2では、ブラウザはCloudFrontからフロントエンドとAPIの両方へアクセスする。

```text
Frontend:
https://xxxxxxxxxxxx.cloudfront.net/

API:
https://xxxxxxxxxxxx.cloudfront.net/api/*
```

同一origin構成になるため、CORS設計を単純化できる。

Backend側でoriginチェックを残す場合は、CloudFront標準ドメインのみを許可する。

---

## 18. CloudWatch Logs設計

## 18.1 Log Group

Backendコンテナ用のLog Groupを作成する。

```text
/ecs/daily-health-tracker-dev-backend
```

## 18.2 Log Driver

ECS Task Definitionでは `awslogs` log driverを使用する。

## 18.3 Retention

ログが無期限に蓄積されないよう、保持期間を設定する。

初期値の例：

```text
Retention:
7 days
```

## 18.4 ログに出力しない情報

以下はログへ出力しない。

* Access Token
* ID Token
* Refresh Token
* Authorizationヘッダー
* DBパスワード
* DATABASE_URL全文
* Cognito Hosted UIの認証コード
* 健康記録の詳細本文
* 個人情報

---

## 19. CloudWatch監視方針

初期構成では、詳細な監視基盤は構築しない。

最低限、以下を確認できるようにする。

* ECS Taskの起動・停止
* ALB TargetのHealthy / Unhealthy
* Backendの5xxエラー
* RDSのCPU使用率
* RDSの空きストレージ
* RDS接続数

将来的なAlarm候補：

* ALB `UnHealthyHostCount`
* ALB `HTTPCode_Target_5XX_Count`
* RDS `FreeStorageSpace`
* RDS `CPUUtilization`

Container Insightsは初期実装では無効とする。

---

## 20. Cognito設計

## 20.1 Cognito User Pool

認証基盤としてCognito User Poolを使用する。

```text
Self Sign-up:
Disabled

MFA:
初期はDisabled

User Creation:
AWS管理画面から手動作成
```

## 20.2 App Client

React SPA用のpublic clientとして作成する。

```text
Client Secret:
なし

OAuth Flow:
Authorization Code Grant

PKCE:
利用
```

## 20.3 Hosted UI

ログイン画面にはCognito Hosted UIを使用する。

Cognitoが提供するドメインを使用し、独自ドメインは作成しない。

## 20.4 Callback URL

Stage 1：

```text
http://localhost:5173/
```

Stage 2：

```text
https://xxxxxxxxxxxx.cloudfront.net/
```

## 20.5 Logout URL

Stage 1：

```text
http://localhost:5173/
```

Stage 2：

```text
https://xxxxxxxxxxxx.cloudfront.net/
```

## 20.6 OAuth Scope

初期構成では以下を利用する。

```text
openid
email
profile
```

## 20.7 API認証

React SPAはAmplify AuthからAccess Tokenを取得し、APIへ付与する。

```http
Authorization: Bearer <access_token>
```

Backendは以下を検証する。

* JWT署名
* 有効期限
* issuer
* client_id
* token_use
* 必要に応じてscope

---

## 21. Cognito UserとアプリUserの紐づけ

Cognitoの `sub` を、アプリケーションUserとの紐づけに使用する。

```text
Cognito sub
↓
User.cognitoSub
↓
User.id
↓
Meal / Condition / Workout
```

## 21.1 初回User作成

認証済みAPIアクセス時に、`cognitoSub` に一致するUserが存在しない場合はUserを作成する。

Cognito Access Tokenには、emailやnameが含まれない場合がある。

そのため、初回User作成時はAccess Tokenを使ってCognito UserInfo endpointからユーザー属性を取得する。

```text
JWT検証
↓
sub取得
↓
User検索
↓
Userなし
↓
Cognito UserInfo取得
↓
email / name取得
↓
User作成
```

UserInfo取得は初回User作成時のみ行い、通常のAPIリクエストごとには実行しない。

Cognito UserInfo endpointは、`openid` scopeを含むAccess Tokenを受け取り、scopeに応じてemailやprofile情報を返す。

この方式では、BackendからCognitoの公開UserInfo endpointへ外向きHTTPS通信が必要になる。現在の方針ではECSをPublic Application Subnet + public IPで動かすため、この通信は成立する。

将来ECSをprivate subnetへ移した場合は、NAT Gateway等の外向き経路を用意するか、User作成方式を変更する必要がある（「37. 将来課題」を参照）。

`name` は取得できない場合を考慮し、DB上でnullableとする。

emailが取得できない場合は、架空の値を保存せずUser作成エラーとして扱う。

なお、現在のPrisma schemaは設計方針とずれており、Cognito導入前にschema migrationが必要である。

```text
現状:
name       String   （必須）
cognitoSub String?  （任意）

Cognito導入後の狙い:
name       String?  （UserInfoで取得できない場合を考慮しnullable）
cognitoSub String   （認証済みUserに対して必須）
```

schema変更もRolling Deploymentを考慮し、Expand → Deploy → Contractで段階的に行う（「26.4 Rolling Deploymentとの整合」を参照）。

---

## 22. S3フロントエンド設計

## 22.1 Bucket

Viteのbuild成果物をS3へ配置する。

S3 Bucket名は全世界で一意である必要があるため、AWS Account ID等をsuffixとして使用する。

例：

```text
daily-health-tracker-dev-frontend-<account-id>
```

## 22.2 Public Access

S3 Block Public Accessを有効にする。

```text
Block Public Access:
Enabled
```

S3 Website Hostingによる直接公開は行わない。

## 22.3 CloudFrontからのアクセス

CloudFront Origin Access Controlを利用し、CloudFrontからのみS3 Objectを取得できるようにする。

```text
Internet
×
S3へ直接アクセス不可

CloudFront
○
S3へアクセス可能
```

## 22.4 Cache-Control

Viteが生成するhash付きassetには長期cacheを設定する。

```text
assets/*.js
assets/*.css

Cache-Control:
public, max-age=31536000, immutable
```

`index.html` は最新のassetを参照できるよう、短いcacheまたは再検証を設定する。

```text
Cache-Control:
no-cache
```

---

## 23. CloudFront設計

## 23.1 Distribution

1つのCloudFront Distributionで、フロントエンドとAPIを配信する。

## 23.2 Default Behavior

```text
Path:
Default /*

Origin:
S3

Allowed Methods:
GET, HEAD

Cache:
有効
```

## 23.3 API Behavior

```text
Path Pattern:
/api/*

Origin:
CloudFront VPC Origin
→ internal ALB

Allowed Methods:
GET, HEAD, OPTIONS, POST, PUT, PATCH, DELETE

Cache:
Disabled
```

API Behaviorでは、以下をBackendへ転送する。

* Authorization
* Content-Type
* Origin
* 必要なrequest header
* query string
* cookieは初期構成では原則不要

## 23.4 SPA Routing

React RouterのURLへ直接アクセスした場合でも、`index.html` を返せるようにする。

対象例：

```text
/daily
/history
```

APIの404や500を `index.html` へ置き換えないため、Distribution全体のCustom Error Responseには依存しない。

Default BehaviorにCloudFront Functionを関連付け、拡張子を持たないフロントエンドパスを `/index.html` へrewriteする方式を採用する。

```text
/daily
→ /index.html

/history
→ /index.html

/api/*
→ rewrite対象外
```

## 23.5 HTTPS

CloudFront標準ドメインとCloudFront標準証明書を使用する。

独自ドメインおよび独自ACM証明書は作成しない。

---

## 24. CI/CD設計

## 24.1 基本構成

```text
GitHub
↓
GitHub Actions
↓ OIDC
AWS IAM Role
↓
ECR / ECS / S3 / CloudFront
```

AWSへの認証にはGitHub Actions OIDCを使用する。

長期的なAccess KeyをGitHub Secretsへ保存しない。

## 24.2 GitHub OIDC Role

OIDC用IAM RoleのTrust Policyでは、対象を以下へ限定する。

* 対象GitHub OrganizationまたはUser
* 対象Repository
* 対象Branch
* 必要に応じてGitHub Environment

## 24.3 Backend Deploy Flow

```text
GitHub Actions
↓
npm ci
↓
lint
↓
test
↓
Docker build
↓
ECRへcommit SHA tagでpush
↓
ecspresso runでmigration
↓
migration成功
↓
ecspresso deploy
↓
ECS Rolling update
↓
Service stable確認
```

## 24.4 Frontend Deploy Flow

```text
GitHub Actions
↓
npm ci
↓
lint
↓
test
↓
Vite build
↓
S3 sync
↓
CloudFront invalidation
```

hash付きassetはファイル名が変わるため、CloudFront invalidationは主に以下を対象とする。

```text
/index.html
```

## 24.5 初期トリガー

構築直後は誤デプロイを避けるため、手動実行を基本とする。

```text
workflow_dispatch
```

安定後は、`main` branchへのpushを自動デプロイトリガーにすることを検討する。

---

## 25. ecspresso管理範囲

ecspressoは、ECSの以下を管理する。

* Task Definition
* ECS Service
* Container image
* Environment variables
* Secret参照
* Deployment configuration
* Rolling deployment
* One-off task実行

Terraformとの管理重複を避けるため、完成形では以下の分担とする。

| 管理対象                 | 管理ツール     |
| -------------------- | --------- |
| VPC / Subnet / Route | Terraform |
| Security Group       | Terraform |
| ALB / Target Group   | Terraform |
| RDS                  | Terraform |
| ECR                  | Terraform |
| IAM Role             | Terraform |
| S3 / CloudFront      | Terraform |
| Cognito              | Terraform |
| ECS Cluster          | Terraform |
| ECS Service          | ecspresso |
| ECS Task Definition  | ecspresso |
| ECS Deployment       | ecspresso |

Terraformとecspressoの両方から同じECS Serviceを変更しない。

## 25.1 学習上の位置づけ

ecspressoを使う構成は技術的に整合しているが、汎用的な学習価値ではTerraformやGitHub Actionsほど普遍的ではない。習得の優先順位は次のとおりとする。

```text
1. AWS手動構築
2. Terraform
3. GitHub Actions + OIDC
4. ECSデプロイ自動化
5. ecspresso
```

ecspressoは設計として残すが、Stage 1やTerraform学習を止めてまで先に習得する必要はない。

---

## 26. Prisma Migration設計

## 26.1 Stage 1：起動時migration

Stage 1では、現行Dockerfileの起動コマンドをそのまま利用する。

```bash
npx prisma migrate deploy && node dist/src/main.js
```

そのため、Stage 1ではmigrationはseed手順とは独立して、最初のECS Task起動時に自動実行される。初回起動時にDB schemaが作成される。

seedは起動コマンドに含めず、one-off taskとして初回のみ1回実行する（「26.5 Seed」を参照）。

## 26.2 Stage 2：起動時migrationを行わない

Stage 2（完成形）では、通常のBackend Task起動時にmigrationを実行しない。

以下の構成は、完成形では採用しない。

```bash
npx prisma migrate deploy && node dist/src/main.js
```

通常起動コマンドは以下とする。

```bash
node dist/src/main.js
```

Stage 2への移行時に、起動時migrationを廃止し、GitHub Actions + ecspresso runへ移す。

## 26.3 Migration実行方法（Stage 2）

GitHub Actionsからecspressoのone-off taskを実行する。

```text
ecspresso run
↓
npx prisma migrate deploy
```

Migration成功後に、通常のECS deployを実行する。

```text
1. Docker image push
2. Prisma migration
3. ECS deploy
```

## 26.4 Rolling Deploymentとの整合

Migration後もしばらく旧Taskが稼働する可能性がある。

そのため、DB migrationは新旧両方のアプリケーションが動作できる変更にする。

基本方針：

```text
Expand
↓
Application Deploy
↓
Contract
```

例：

```text
1回目のmigration:
新しいcolumnを追加する
既存columnは残す

Application Deploy:
新旧columnへ対応する

後続migration:
旧columnを削除する
```

破壊的なschema変更を、同一デプロイで一度に行わない。

## 26.5 Seed

Seedは通常のデプロイごとには実行しない。

Stage 1・Stage 2いずれも、初期構築時や必要な場合だけ、one-off taskとして実行する。

```bash
node dist/prisma/seed.js
```

---

## 27. Swagger設計

BackendのSwaggerは環境変数で制御する。

```text
ENABLE_SWAGGER=true
```

の場合のみ、Swaggerを公開する。

AWS上の完成形では以下とする。

```text
ENABLE_SWAGGER=false
```

本番相当環境でSwaggerを外部へ常時公開しない。

将来的に必要になった場合は、以下のいずれかを検討する。

* 社内ネットワークのみ許可
* Basic認証
* VPN経由
* 開発環境のみ有効

---

## 28. コスト抑制方針

初期構成では、以下のコスト抑制を行う。

| 項目                   | 方針                 |
| -------------------- | ------------------ |
| ECS                  | 0.25 vCPU / 0.5 GB |
| ECS Task数            | desiredCount 1     |
| ECS Capacity         | Fargate On-Demand  |
| RDS                  | 最小instance class   |
| RDS Availability     | Single-AZ          |
| RDS Storage          | 最小容量               |
| NAT Gateway          | 使用しない              |
| Multi-AZ             | 使用しない              |
| Read Replica         | 使用しない              |
| Auto Scaling         | 使用しない              |
| Container Insights   | 使用しない              |
| 独自ドメイン               | 取得しない              |
| Route 53 Hosted Zone | 作成しない              |
| WAF                  | 初期は使用しない           |
| CloudWatch Logs      | 保持期間7日             |
| Environment          | devのみ              |

## 28.1 長期間利用しない場合

長期間作業を中断する場合は、以下を検討する。

```text
ECS:
desiredCount = 0

RDS:
一時停止

ALB:
長期間不要なら削除

CloudFront:
不要ならDistribution削除

Terraform環境:
必要に応じてdestroy
```

ALBは停止できないため、長期間使用しない場合は削除する。

RDSは停止中も一部費用が残り、一定期間後に自動再起動するため、長期間不要な場合はsnapshot取得後の削除も検討する。

## 28.2 Budget

AWS Budgetsで月額予算を設定する。

例：

```text
Budget:
月額上限を設定

Alert:
50%
80%
100%
```

請求アラートを早い段階で設定する。

ただし、AWS Budgetsは課金の上限を強制的に停止する機能ではなく、あくまで通知である。請求情報の反映と通知には遅延があるため、通知後も料金が増える可能性がある。Budget通知に頼りきらず、Billing画面と各リソースを定期的に確認する。

---

## 29. リソース命名規則

基本形式：

```text
<project>-<environment>-<resource>
```

例：

| Resource          | 名前例                                             |
| ----------------- | ----------------------------------------------- |
| ECS Cluster       | `daily-health-tracker-dev-cluster`              |
| ECS Service       | `daily-health-tracker-dev-backend-service`      |
| ALB               | `daily-health-tracker-dev-alb`                  |
| Target Group      | `daily-health-tracker-dev-backend-tg`           |
| RDS               | `daily-health-tracker-dev-db`                   |
| Log Group         | `/ecs/daily-health-tracker-dev-backend`         |
| Cognito User Pool | `daily-health-tracker-dev-users`                |
| Secret            | `daily-health-tracker/dev/backend/database-url` |
| ECR               | `daily-health-tracker-backend`                  |

AWS側の文字数制限に収まらない場合は、省略形を利用する。

例：

```text
dht-dev-backend-tg
```

---

## 30. Tag設計

Terraformで作成する主要リソースへ共通tagを付与する。

```text
Project:
daily-health-tracker

Environment:
dev

ManagedBy:
Terraform
```

必要に応じて以下を追加する。

```text
Application:
backend / frontend / database / auth
```

Tagは、リソース検索とコスト確認に利用する。

---

## 31. Terraform化方針

## 31.1 構築順序

最初はAWSコンソールと必要箇所のAWS CLIを利用して構築する。

目的：

* VPCとSubnetの関係を理解する
* ALBとTarget Groupの関係を理解する
* ECS Cluster、Service、Task Definitionの関係を理解する
* Security Group間参照を理解する
* RDS Subnet Groupを理解する
* CognitoとCloudFrontの設定関係を理解する

手動構築で構成を理解した後、Terraform化する。

## 31.2 Terraform化方法

学習用環境でデータ保持が不要な場合は、以下を推奨する。

```text
1. 手動構築
2. 接続確認
3. 設定値を記録
4. 手動リソースを削除
5. Terraformで再構築
```

既存リソースを残す必要がある場合のみ、Terraform importを検討する。

## 31.3 Terraform化後の運用

Terraform化後は、Terraform管理対象のAWSリソースをAWSコンソールから直接変更しない。

```text
AWS構成変更
↓
Terraformコード変更
↓
terraform plan
↓
内容確認
↓
terraform apply
```

ECS Task DefinitionとService deploymentはecspressoで管理する。

---

## 32. Terraformディレクトリ候補

```text
infra/
  terraform/
    environments/
      dev/
        main.tf
        variables.tf
        outputs.tf
        terraform.tfvars

    modules/
      network/
      security/
      database/
      load-balancer/
      container/
      frontend/
      auth/
      cicd/
```

初期実装では、過度にmodule分割しない。

Terraformコード量が少ない段階では、環境単位のファイル構成から開始してもよい。

---

## 33. AWS構築順序

## 33.1 Stage 1

```text
AWS-1:
最小構成設計

AWS-2:
ECR Repository作成
Backend image push

AWS-3:
VPC / Subnet / Route / Internet Gateway作成

AWS-4:
Security Group作成

AWS-5:
RDS PostgreSQL作成

AWS-6:
Secrets Manager作成

AWS-7:
IAM Role作成

AWS-8:
ECS Cluster / Task Definition作成

AWS-9:
Target Group / ALB / Listener作成

AWS-10:
ECS Service作成
ALB Target Groupへ接続

AWS-11:
GET /api/health 疎通確認

AWS-12:
ECS → RDS接続確認 / seed
```

ALBに接続するECS Serviceを作るには、先にTarget GroupとALB Listenerが必要なため、ALBをService より先に作成する。ClusterとTask Definitionは先に作ってよいが、ServiceはALBの後が自然である。

Prisma migrationは、現行Dockerfileの起動コマンドにより最初のECS Task起動時（AWS-10）に自動実行される。AWS-12では、migrationとは独立してseedをone-off taskで1回だけ実行する（「26. Prisma Migration設計」を参照）。

## 33.2 Stage 2

```text
AWS-13:
Cognito User Pool / App Client / Hosted UI

AWS-14:
Backend JWT検証

AWS-15:
S3 frontend bucket

AWS-16:
CloudFront Distribution

AWS-17:
CloudFront VPC Origin / internal ALB

AWS-18:
Frontend build / deploy

AWS-19:
Cognito callback / logout URL変更

AWS-20:
CloudFront経由の画面・API疎通

AWS-21:
GitHub Actions OIDC

AWS-22:
ecspresso deploy

AWS-23:
Terraform化
```

---

## 34. Stage 1完了条件

以下を満たした場合、Stage 1完了とする。

* ECRにBackend imageが存在する
* ECS Taskが起動する
* ECS ServiceのdesiredCountが1で維持される
* ALB TargetがHealthyになる
* ALB経由で `/api/health` が200を返す
* RDSがprivate accessで作成されている
* ECSからRDSへ接続できる
* Prisma migrationが成功する
* BackendログがCloudWatch Logsへ出力される
* RDSへインターネットから直接接続できない

---

## 35. Stage 2完了条件

以下を満たした場合、Stage 2完了とする。

* CloudFront標準ドメインでReact SPAを表示できる
* S3が非公開である
* CloudFrontからのみS3へアクセスできる
* `/daily` や `/history` への直接アクセスが成功する
* `/api/*` がCloudFrontからBackendへ転送される
* ALBがinternalである
* Cognito Hosted UIでログインできる
* Authorization Code + PKCEが動作する
* Access TokenでAPIを呼び出せる
* Cognito `sub` からUserを特定できる
* 他ユーザーのデータへアクセスできない
* GitHub ActionsがOIDCでAWSへ接続できる
* ecspressoでRolling deploymentできる
* Deployment Circuit Breakerと自動rollbackが有効である
* migrationがone-off taskとして実行される
* Terraformでインフラを再構築できる

---

## 36. 初期実装では採用しない構成

初期実装では、以下を採用しない。

* NAT Gateway
* Multi-AZ RDS
* RDS Read Replica
* ECS Auto Scaling
* Fargate Spot
* Blue/Green Deployment
* AWS WAF
* Route 53
* 独自ドメイン
* ALB用独自ACM証明書
* API Gateway
* Lambda Backend
* ElastiCache
* SQS
* EventBridge
* Container Insights
* 複数環境
* Disaster Recovery環境
* BFF + HttpOnly Cookie

---

## 37. 将来課題

将来的に利用者や要件が増えた場合は、以下を検討する。

* ECS Taskをprivate subnetへ移動
    * この場合、Backend → Cognito UserInfo endpoint等への外向きHTTPS通信経路が失われるため、NAT Gatewayまたは必要なVPC Endpointを用意するか、初回User作成方式を変更する
* NAT GatewayまたはVPC Endpoint導入
* RDS Multi-AZ
* ECS desiredCountを2以上へ変更
* ECS Auto Scaling
* Fargate Spotとの混在
* AWS WAF
* 独自ドメイン
* Route 53
* ACM証明書
* ALB HTTPS Listener
* CloudWatch Alarm拡充
* Datadog / Sentry
* CloudWatch Database Insights（Advanced mode）
* Blue/Green Deployment
* 複数AWS環境
* BFF + HttpOnly Cookie
* Backup・復旧手順の強化
* CloudTrail監査
* GuardDuty等のセキュリティサービス

---

## 38. 関連ドキュメント

| ドキュメント                          | 関連内容                                     |
| ------------------------------- | ---------------------------------------- |
| `03-api-design.md`              | ALB、CloudFront、API path、認証方式             |
| `04-auth-design.md`             | Cognito User Pool、Hosted UI、Access Token |
| `05-frontend-design.md`         | S3、CloudFront、環境変数、API Base URL          |
| `06-data-items.md`              | User、cognitoSub、DB項目                     |
| `07-validation-error-design.md` | APIエラー、認証エラー                             |
| `08-state-data-flow.md`         | Access Token取得、401処理                     |
| `09-test-viewpoints.md`         | AWS上での結合・E2Eテスト                          |
| `10-adr.md`                     | AWS・認証・デプロイ方式の設計判断                       |
| `12-operation-design.md`        | 運用、障害対応、バックアップ、費用監視                      |
