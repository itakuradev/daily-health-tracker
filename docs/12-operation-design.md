# 健康管理マスター 運用・監視設計書 v0.1

## 1. ドキュメントの目的

本ドキュメントは、健康管理マスターをAWS上で安定して運用するための方針を定義する資料である。

本ドキュメントでは、以下を整理する。

* 運用・監視の基本方針
* 可観測性の設計
* ログ設計
* メトリクス・アラーム設計
* 通知設計
* デプロイ・ロールバック運用
* DB migration運用
* バックアップ・リストア
* 障害対応
* セキュリティ・監査
* コスト監視
* 定期メンテナンス
* 運用手順書の管理
* 将来の拡張方針

AWS Well-Architected FrameworkのOperational ExcellenceおよびReliabilityの考え方に合わせ、技術メトリクスを収集するだけでなく、利用者に影響する状態を把握し、対応可能なアラートだけを通知することを基本とする。

---

## 2. 運用・監視の基本方針

運用・監視では、以下を基本方針とする。

* AWS上の主要コンポーネントを一通り監視する
* アプリケーションの正常性を利用者視点でも判断する
* ログ・メトリクス・イベントを組み合わせて調査する
* アラームは対応可能なものに限定する
* アラームごとに初動手順を定義する
* 障害発生時は、原因調査より先にサービスの安定化を優先する
* 手作業で繰り返す運用は徐々に自動化する
* 本番相当環境の直接変更を避け、Terraform・ecspresso・GitHub Actionsを利用する
* 個人開発として維持可能なコストに抑える
* 健康記録、token、パスワード等をログへ出力しない
* 定期的にバックアップからの復旧手順を確認する

可観測性は、メトリクス・ログ・トレースの3要素を基本とする。初期構成ではメトリクスとログを優先し、分散トレーシングは将来課題とする。

---

## 3. 運用対象

本ドキュメントで扱う主な運用対象は以下である。

| 分類       | 対象                                            |
| -------- | --------------------------------------------- |
| フロントエンド  | CloudFront、S3、React SPA                       |
| 認証       | Cognito User Pool、Hosted UI                   |
| API入口    | CloudFront `/api/*`、Application Load Balancer |
| アプリケーション | ECS Fargate、NestJS                            |
| コンテナ     | ECR、ECS Task Definition                       |
| データベース   | RDS for PostgreSQL                            |
| 機密情報     | Secrets Manager                               |
| ログ・監視    | CloudWatch Logs、Metrics、Alarms、Dashboard      |
| 通知       | Amazon SNS、AWS User Notifications             |
| 監査       | CloudTrail                                    |
| コスト      | AWS Budgets、Cost Anomaly Detection            |
| CI/CD    | GitHub Actions、OIDC、ecspresso                 |
| IaC      | Terraform                                     |

---

## 4. 運用体制

## 4.1 初期運用体制

初期運用では、利用者・開発者・運用担当者は同一人物とする。

```text
利用者:
本人のみ

開発者:
本人

運用担当者:
本人
```

## 4.2 サポート時間

初期運用では、24時間365日の有人監視を行わない。

アラームはメールへ通知するが、即時対応を保証しない。

```text
外部向けSLA:
なし

24時間オンコール:
なし

障害対応:
ベストエフォート
```

複数ユーザーへ公開する場合は、運用時間、連絡手段、対応目標を再設計する。

## 4.3 運用目標

以下は外部保証ではなく、運用上の暫定目標とする。

| 項目      | 暫定目標                       |
| ------- | -------------------------- |
| 重大障害の検知 | CloudWatch Alarmで5〜10分以内   |
| RTO     | 運用担当者が対応可能な時間帯で8時間以内       |
| RPO     | 最大24時間                     |
| デプロイ失敗時 | 自動ロールバックまたは直前imageへ手動復旧    |
| コスト異常   | BudgetまたはCost Anomaly通知で検知 |

RDSの自動バックアップでは、指定した保持期間内のポイントインタイムリカバリが利用できるが、初期運用では余裕を持ったRPOを設定する。

---

## 5. Stage別の運用範囲

## 5.1 Stage 1：バックエンド最小構成

Stage 1では、以下を監視対象とする。

* internet-facing ALB
* ECS Fargate
* RDS PostgreSQL
* CloudWatch Logs
* Secrets Manager
* ECR
* AWS料金

Stage 1では実データを扱わず、ダミーデータによる疎通確認を行う。

## 5.2 Stage 2：完成形

Stage 2では、Stage 1に加えて以下を監視する。

* CloudFront
* S3
* Cognito
* internal ALB
* GitHub Actionsデプロイ
* CloudTrail
* フロントエンドからAPIまでの一連の動作
* バックアップ・復旧
* AWS Health
* コスト異常

---

## 6. 可観測性の全体構成

```text
React SPA / Browser
        ↓
CloudFront Metrics / Access Logs
        ↓
ALB Metrics / Access Logs
        ↓
NestJS Structured Logs
        ↓
CloudWatch Logs / Logs Insights
        ↓
ECS・RDS・Cognito Metrics
        ↓
CloudWatch Dashboard
        ↓
CloudWatch Alarms
        ↓
SNS Email Notification
```

AWSサービスのメンテナンスやアカウント固有イベントは、AWS HealthおよびAWS User Notificationsで通知する。

```text
AWS Health
↓
AWS User Notifications
↓
Email
```

AWS Healthでは、サービス全体のイベントとアカウントに影響するイベントを確認できる。AWS User Notificationsを利用すると、対象カテゴリを指定して通知を集約できる。

---

## 7. 監視シグナル

監視では、以下のシグナルを組み合わせる。

| シグナル         | 主な用途                      |
| ------------ | ------------------------- |
| Metrics      | 異常の検知、傾向の把握               |
| Logs         | 原因調査、リクエスト追跡              |
| Events       | デプロイ、RDS、AWS Health等の状態変化 |
| Traces       | サービス間の遅延・障害箇所の特定          |
| User Journey | ログイン、記録保存、履歴表示の確認         |

初期実装では以下を採用する。

```text
Metrics:
採用

Logs:
採用

Events:
採用

Distributed Tracing:
初期は不採用

Synthetic Monitoring:
初期は不採用
```

---

## 8. 利用者視点の正常性

インフラリソースが起動しているだけでなく、以下の操作が成立することをアプリケーションの正常状態とする。

* CloudFrontからフロントエンドが表示できる
* Cognito Hosted UIでログインできる
* Access Token付きでAPIを呼び出せる
* `/api/health` が200を返す
* 食事・体調・筋トレ記録を保存できる
* 保存した記録を履歴画面から取得できる
* 他ユーザーのデータへアクセスできない

初期監視では主にAWSメトリクスを利用する。

将来的にはCloudWatch Synthetics等を利用し、CloudFrontからAPIまでの外形監視を追加する。

---

## 9. 通知設計

## 9.1 CloudWatch Alarm通知

CloudWatch Alarmの通知先としてSNS Topicを作成する。

```text
SNS Topic:
daily-health-tracker-dev-alerts

Subscription:
運用担当者のメールアドレス
```

CloudWatch AlarmはSNSまたはAWS User Notificationsを利用して状態変化を通知できる。初期構成では、構成が単純なSNSメール通知を利用する。

## 9.2 通知対象

通知する主なイベントは以下。

* CloudFront 5xx増加
* ALBの正常Target消失
* ALB Target 5xx増加
* ECS CPU・Memory高騰
* ECSデプロイ失敗
* RDS空き容量不足
* RDS高CPU
* RDSイベント
* Cost Budget超過
* Cost Anomaly
* AWS Healthの要対応イベント

## 9.3 通知しないもの

以下は原則として通知せず、Dashboardまたは定期確認に留める。

* 一時的なCPU上昇
* 単発の4xx
* 正常なログイン失敗
* 開発中の意図的なTask停止
* planned maintenance中の停止
* 直ちに対応する必要がない情報イベント

対応不要なアラームを増やすと、重要な通知を見落とす原因になるため、アラームごとに対応手順を定義する。

---

## 10. 障害レベル

## 10.1 Severity定義

| Severity | 内容                         | 例                            |
| -------- | -------------------------- | ---------------------------- |
| Critical | サービス利用不可、データ損失、重大なセキュリティ問題 | 正常Targetが0、RDS利用不可、secret漏えい |
| High     | 主要機能が継続的に失敗                | API 5xx継続、ログイン不能、migration失敗 |
| Medium   | 性能劣化、リソース逼迫                | CPU・Memory高騰、RDS空き容量低下       |
| Low      | 即時対応不要                     | 依存パッケージ更新、軽微な警告              |

## 10.2 対応方針

```text
Critical:
サービスの安定化を最優先
必要なら直前versionへ戻す

High:
影響範囲を確認し、当日中の復旧を目指す

Medium:
原因を調査し、計画的に改善する

Low:
定期メンテナンスで対応する
```

---

## 11. CloudWatch Dashboard

CloudWatch Dashboardを1つ作成する。

```text
Dashboard名:
daily-health-tracker-dev
```

CloudWatch AlarmはDashboardへ配置でき、`OK`、`ALARM`、`INSUFFICIENT_DATA`を一画面で確認できる。

## 11.1 Dashboard表示項目

### CloudFront

* Requests
* 4xxErrorRate
* 5xxErrorRate
* TotalErrorRate

### ALB

* RequestCount
* TargetResponseTime
* HTTPCode_Target_4XX_Count
* HTTPCode_Target_5XX_Count
* HealthyHostCount
* UnHealthyHostCount

### ECS

* CPUUtilization
* MemoryUtilization

### RDS

* CPUUtilization
* FreeableMemory
* FreeStorageSpace
* DatabaseConnections
* ReadLatency
* WriteLatency

### アラーム

* 現在ALARM状態の一覧
* 直近の状態変化

---

## 12. アプリケーションログ設計

## 12.1 ログ出力先

NestJS Backendの標準出力・標準エラーを、ECSの `awslogs` log driverでCloudWatch Logsへ送信する。

FargateでCloudWatch Logsへ送信するには、Task Definitionに `awslogs` の設定を行う。

```text
Log Group:
/ecs/daily-health-tracker-dev-backend
```

## 12.2 ログ形式

アプリケーションログは、原則としてJSON形式の構造化ログとする。

JSONログはCloudWatch Logs Insightsから各フィールドを指定して検索しやすい。

例：

```json
{
  "timestamp": "2026-07-15T10:00:00.000Z",
  "level": "info",
  "service": "backend",
  "environment": "dev",
  "event": "http_request_completed",
  "requestId": "0190c6f0-0000-7000-8000-000000000000",
  "traceId": "Root=1-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx",
  "method": "POST",
  "path": "/api/meals",
  "statusCode": 200,
  "durationMs": 45
}
```

## 12.3 共通ログ項目

| 項目          | 内容                          |
| ----------- | --------------------------- |
| timestamp   | ISO 8601形式の発生日時             |
| level       | debug / info / warn / error |
| service     | サービス名                       |
| environment | dev等の環境名                    |
| event       | ログイベント名                     |
| requestId   | Backendで発行するリクエスト識別子        |
| traceId     | ALBから受け取ったTrace ID          |
| method      | HTTP method                 |
| path        | API path                    |
| statusCode  | HTTP status                 |
| durationMs  | 処理時間                        |
| errorCode   | アプリケーションエラーコード              |
| message     | 概要                          |
| stack       | error時のみ                    |

ALBはリクエストに `X-Amzn-Trace-Id` を追加するため、Backendログに記録することでALBアクセスログとの関連付けに利用できる。

## 12.4 ログレベル

| レベル   | 使用例                  |
| ----- | -------------------- |
| debug | ローカル開発時の詳細確認         |
| info  | 起動、終了、正常な主要処理        |
| warn  | 再試行可能な異常、想定内の劣化      |
| error | API 5xx、DB接続失敗、想定外例外 |

本番相当環境では、通常のログレベルを `info` とする。

---

## 13. ログへ出力しない情報

以下をログへ出力しない。

* Cognito Access Token
* ID Token
* Refresh Token
* Authorizationヘッダー
* Cognito認証コード
* パスワード
* DATABASE_URL
* DBパスワード
* Secretの値
* 食事内容のメモ
* 筋トレメモ
* 体重、ウエスト等の健康情報
* メールアドレス
* request body全文
* response body全文
* Cookie全文

エラー調査のために入力項目名を記録することは許可するが、入力値自体は記録しない。

例：

```json
{
  "event": "validation_failed",
  "fields": ["weight", "conditionScore"]
}
```

---

## 14. ログ保持期間

| ログ                      |          保持期間 |
| ----------------------- | ------------: |
| Backend CloudWatch Logs |            7日 |
| ALB Access Logs         |           30日 |
| CloudFront Access Logs  |           30日 |
| CloudTrail Trail Logs   |         90日以上 |
| GitHub Actions Logs     | GitHub側の設定に従う |

CloudWatch Logsは保持期間を設定しない場合、無期限で保持されるため、Log Group作成時に明示的なretentionを設定する。

---

## 15. Access Log設計

## 15.1 ALB Access Logs

Stage 2ではALB Access Logsを有効にする。

ALB Access Logsには、リクエスト時刻、パス、レスポンスコード、処理時間などが記録され、トラフィック分析や障害調査に利用できる。

```text
保存先:
専用のprivate S3 bucket

Prefix:
alb/

Lifecycle:
30日後に削除
```

## 15.2 CloudFront Access Logs

Stage 2ではCloudFront標準アクセスログを有効にする。

CloudFront標準ログには、Viewer Requestの時刻、パス、処理時間、レスポンス等が記録される。

```text
保存先:
専用のprivate S3 bucket

Prefix:
cloudfront/

Lifecycle:
30日後に削除
```

## 15.3 Access Logの注意事項

Access LogにはIPアドレスやリクエストパスが含まれるため、以下を徹底する。

* S3 Block Public Accessを有効にする
* IAM権限を運用担当者に限定する
* 保存期間を限定する
* URLへ健康情報を含めない
* query parameterへ個人情報を含めない

---

## 16. Logs Insights

CloudWatch Logs Insightsで、主要な検索クエリを保存する。

## 16.1 直近のerrorログ

```text
fields @timestamp, requestId, event, errorCode, message
| filter level = "error"
| sort @timestamp desc
| limit 100
```

## 16.2 API別5xx

```text
fields @timestamp, method, path, statusCode, durationMs, requestId
| filter statusCode >= 500
| stats count() by path, statusCode
| sort count() desc
```

## 16.3 遅いAPI

```text
fields @timestamp, method, path, durationMs, requestId
| filter durationMs >= 1000
| sort durationMs desc
| limit 100
```

## 16.4 認証エラー

```text
fields @timestamp, path, statusCode, errorCode, requestId
| filter statusCode = 401 or statusCode = 403
| sort @timestamp desc
```

---

## 17. メトリクス・アラーム共通方針

## 17.1 閾値

初期閾値は暫定値とし、実際の利用状況を確認して調整する。

```text
初期:
一般的な閾値を設定

運用開始後:
平常時の値を確認

調整:
誤検知・未検知を減らす
```

## 17.2 評価期間

一時的な変動で通知しないよう、原則として複数のdatapointを評価する。

例：

```text
Period:
1分

Evaluation Periods:
5

Datapoints to Alarm:
3
```

重大な停止検知は、より短い期間を設定する。

## 17.3 Missing Data

低トラフィック環境ではメトリクスが存在しない場合がある。

基本方針：

| メトリクス             | Missing Data         |
| ----------------- | -------------------- |
| CPU・Memory        | notBreaching         |
| 5xx件数             | notBreaching         |
| HealthyHostCount  | breachingまたは別イベントで補完 |
| planned shutdown中 | アラームを一時停止            |

Amazon ECSのメトリクスは、Taskが `RUNNING` 状態のときに送信され、実行Taskがない場合はメトリクスが報告されない。

---

## 18. CloudFront監視

CloudFrontは以下を監視する。

| Metric         | Warning目安 | Critical目安 |
| -------------- | --------: | ---------: |
| 5xxErrorRate   | 1%以上が5分継続 |  5%以上が5分継続 |
| 4xxErrorRate   |      傾向確認 |  通常値から大幅増加 |
| TotalErrorRate |      傾向確認 |    5%以上が継続 |
| Requests       |    利用傾向確認 |     急増時に確認 |

CloudFrontは `4xxErrorRate`、`5xxErrorRate` 等をCloudWatchへ公開し、これらを利用したAlarmを設定できる。

低トラフィックでは1件のエラーで割合が大きくなるため、初期運用後に閾値を調整する。

---

## 19. ALB監視

| Metric                    | 条件例       | Severity |
| ------------------------- | --------- | -------- |
| HealthyHostCount          | 1未満が2分継続  | Critical |
| UnHealthyHostCount        | 1以上が2分継続  | Critical |
| HTTPCode_Target_5XX_Count | 1以上が複数回発生 | High     |
| HTTPCode_ELB_5XX_Count    | 1以上が複数回発生 | High     |
| TargetResponseTime        | 1秒超が5分継続  | Medium   |
| RequestCount              | 急増・急減の確認  | Low      |

ALBは `UnHealthyHostCount`、Target 5xx、Target Response Time等をCloudWatchへ送信する。

## 19.1 ALB障害時の確認順序

```text
1. Target GroupのHealthy / Unhealthy
2. ECS Taskの起動状態
3. ECS Taskの停止理由
4. /api/health の応答
5. Backend CloudWatch Logs
6. Security Group
7. ALB Access Logs
```

---

## 20. ECS監視

| Metric / Event            | 条件例        | Severity |
| ------------------------- | ---------- | -------- |
| CPUUtilization            | 80%以上が5分継続 | Medium   |
| MemoryUtilization         | 80%以上が5分継続 | High     |
| Deployment Failed         | 1回         | High     |
| Task stopped unexpectedly | 発生         | High     |
| Service steady state未到達   | 継続         | High     |

CPU・Memoryの80%は初期閾値とし、実際の平常値を確認して変更する。

## 20.1 Container Insights

初期構成ではContainer Insightsを無効とする。

通常のECS ServiceメトリクスとALB監視で開始する。

Container単位・Task単位の詳細なメトリクスが必要になった場合に、有効化を検討する。Container Insightsはコンテナ・Taskの追加メトリクスやログを収集できる。

## 20.2 デプロイ監視

ECS Deployment Circuit Breakerを有効にし、新Taskがsteady stateへ到達できない場合は自動ロールバックする。

ECSはDeployment Circuit BreakerまたはCloudWatch Alarmによってデプロイ失敗を検知し、直前の正常なデプロイへ戻す設定ができる。

---

## 21. RDS監視

RDSは標準でCloudWatchへ1分間隔のメトリクスを送信する。

| Metric              | 条件例           | Severity |
| ------------------- | ------------- | -------- |
| CPUUtilization      | 80%以上が10分継続   | Medium   |
| FreeableMemory      | 128MiB未満が5分継続 | High     |
| FreeStorageSpace    | 2GiB未満        | Critical |
| DatabaseConnections | 上限の80%以上      | High     |
| ReadLatency         | 平常値から大幅上昇     | Medium   |
| WriteLatency        | 平常値から大幅上昇     | Medium   |

閾値は選択したDB instance class、最大接続数、平常時の使用量に応じて調整する。

## 21.1 RDS Event Notification

以下のRDSイベントをSNSメールで通知する。

* DB instance停止
* DB instance再起動
* DB instance障害
* バックアップ失敗
* ストレージ不足
* maintenance開始・完了
* snapshot失敗

RDSはSNSを利用してDB instanceやsnapshot等のイベントを通知できる。

---

## 22. Cognito監視

以下を監視対象とする。

* Sign-inの成功・失敗傾向
* Token refresh
* Throttle
* App Clientごとの利用量
* Hosted UI設定変更
* User Pool設定変更

Cognito User PoolはCloudWatchへサインイン、token refresh、throttle等のメトリクスを公開する。

初期利用者は本人のみであるため、通常のログイン失敗はアラームにしない。

以下のみ通知候補とする。

```text
TokenRefreshThrottles:
1以上が継続

ThrottleCount:
継続的な発生

ログイン不能:
利用者の手動確認で検知
```

---

## 23. Cost監視

## 23.1 AWS Budgets

月額Cost Budgetを作成する。

予算額は、AWS構築後の見積金額に基づき設定する。

通知例：

| 条件     | 通知    |
| ------ | ----- |
| 実績50%  | Email |
| 実績80%  | Email |
| 実績100% | Email |
| 予測100% | Email |

AWS Budgetsでは、実績または予測金額が設定値を超えた場合に、メールまたはSNSへ通知できる。

## 23.2 Cost Anomaly Detection

AWS Cost Anomaly Detectionを有効にする。

```text
Monitor:
AWS services

通知:
EmailまたはAWS User Notifications

閾値:
少額から開始し調整
```

Cost Anomaly Detectionは、通常と異なる支出パターンを検知して通知する。

## 23.3 定期確認

月1回、以下を確認する。

* サービス別費用
* ALB費用
* RDS費用
* Fargate費用
* CloudWatch Logs費用
* CloudFront費用
* Secrets Manager費用
* 不要なECR image
* 不要なsnapshot
* 停止忘れのリソース

---

## 24. AWS Health監視

AWS User Notificationsで、以下のAWS Healthイベントを購読する。

* Account-specific issue
* Scheduled change
* AWS service lifecycle
* Security関連の通知
* `ACTION_REQUIRED` のイベント

AWS HealthイベントはEventBridgeまたはAWS User Notificationsを利用して通知できる。

---

## 25. CloudTrail・監査設計

## 25.1 Stage 1

Stage 1では、CloudTrail Event Historyを利用する。

CloudTrail Event Historyでは、AWS Console、CLI、SDK/APIによる直近90日間のManagement Eventを検索できる。

確認例：

* ECS Serviceを誰が更新したか
* Security Groupを誰が変更したか
* Secretを誰が変更したか
* RDSを誰が停止・削除したか
* IAM Roleを誰が変更したか

## 25.2 Stage 2

Stage 2では、継続的な監査記録のためCloudTrail Trailを作成する。

```text
Trail:
Multi-Region

Management Events:
Read / Write

Data Events:
初期は無効

保存先:
private S3 bucket

Log File Validation:
有効

Lifecycle:
90日後に削除または低頻度ストレージへ移行
```

Data Eventは件数とコストが増える可能性があるため、初期構成では有効にしない。

## 25.3 Secrets Manager監査

Secrets ManagerのAPI操作はCloudTrailへ記録されるため、Secretの変更・削除・参照に関する調査に利用する。

---

## 26. デプロイ運用

## 26.1 デプロイ経路

完成形では、BackendをローカルPCから直接デプロイしない。

```text
GitHub Pull Request
↓
Review
↓
mainへmerge
↓
GitHub Actions
↓ OIDC
AWS
↓
ECR push
↓
migration one-off task
↓
ecspresso deploy
↓
ECS Rolling Update
```

## 26.2 デプロイ前確認

* lintが成功している
* unit testが成功している
* API testが成功している
* Docker buildが成功している
* migration内容を確認している
* 破壊的schema変更がない
* 環境変数の追加漏れがない
* Secretの追加漏れがない
* Task Definition差分を確認している
* commit SHAをimage tagとして使用している

## 26.3 デプロイ後確認

* GitHub Actionsが成功している
* ECS Deploymentが完了している
* Running Taskが1である
* Target GroupがHealthyである
* `/api/health` が200を返す
* Backendに新しいerrorログがない
* CloudFrontからAPIを呼び出せる
* ログインできる
* 記録の取得・保存ができる

## 26.4 Smoke Test

デプロイ後は最低限、以下を確認する。

```text
1. Frontend表示
2. Cognitoログイン
3. GET /api/health
4. 食事記録取得
5. 食事記録保存
6. 履歴表示
```

実データを変更したくない場合は、テスト用日付またはテスト用Userを使用する。

---

## 27. ロールバック運用

## 27.1 自動ロールバック

ECS Deployment Circuit Breakerによる自動ロールバックを第一手段とする。

対象：

* Task起動失敗
* コンテナ起動失敗
* ALB Health Check失敗
* Service steady state未到達

## 27.2 手動ロールバック

自動ロールバックで復旧しない場合は、直前の正常なTask DefinitionまたはDocker imageへ戻す。

```text
1. 最後に正常だったcommit SHAを特定
2. 対応するECR imageを確認
3. ecspressoで旧Task Definitionへ戻す
4. ECS Service安定を待つ
5. ALB Healthyを確認
6. Smoke Test
```

## 27.3 DB変更を含む場合

DB migration後にアプリケーションを戻す場合は、旧アプリケーションが新schemaで動作できることを確認する。

原則としてmigrationを即座にdownしない。

Expand and Contract方式により、新旧アプリケーションが同時に動作できるschema変更を行う。

---

## 28. Prisma Migration運用

## 28.1 実行方法

通常のECS Task起動時にはmigrationを実行しない。

GitHub Actionsからone-off taskを実行する。

```text
ECR push
↓
migration task
↓
migration成功
↓
通常のECS deploy
```

## 28.2 migration失敗時

```text
1. ECS deployを開始しない
2. migration taskのCloudWatch Logsを確認
3. DB接続・権限を確認
4. Prisma migration状態を確認
5. migrationを修正
6. 再実行
```

migration失敗状態のまま通常Taskをデプロイしない。

## 28.3 破壊的変更

以下は同一デプロイで一度に実施しない。

* 使用中columnの削除
* 必須columnの即時追加
* 型の非互換変更
* tableの即時削除
* 大量データの一括変換

---

## 29. バックアップ設計

## 29.1 RDS自動バックアップ

| Stage   | 保持期間 |
| ------- | ---: |
| Stage 1 |   1日 |
| Stage 2 |   7日 |

自動バックアップを無効化しない。

RDSの自動バックアップはDB instance全体を対象とし、指定した保持期間内でポイントインタイムリカバリに利用できる。

## 29.2 Manual Snapshot

以下の前にManual Snapshotを取得する。

* 破壊的migration
* RDS instance削除
* Terraform destroy
* DB major version update
* 大規模なデータ修正
* バックアップ・復旧テスト

Snapshot名の例：

```text
daily-health-tracker-dev-before-migration-20260715
```

## 29.3 Snapshot保持

不要なManual Snapshotが蓄積しないよう、月1回確認する。

保持理由がないSnapshotは削除する。

---

## 30. リストア手順

RDSの復元では、既存DBへ直接上書きせず、新しいDB instanceとして復元する。

```text
1. 復元元のsnapshotまたは時点を選択
2. 新しいRDS instanceとしてrestore
3. Security Groupを設定
4. DB接続を確認
5. DATABASE_URLを新しいendpointへ変更
6. ECS Taskを再デプロイ
7. migration状態を確認
8. API Smoke Test
9. データ内容を確認
10. 問題なければ旧DBを停止
```

## 30.1 リストアテスト

Stage 2完成後は、少なくとも半年に1回、または大きなDB変更前にリストアテストを行う。

確認項目：

* SnapshotからDBを復元できる
* ECSから接続できる
* Prisma migration状態が正常
* 記録を取得できる
* 最新の想定データが存在する
* 復旧手順に不足がない

バックアップが存在するだけでなく、実際に復元可能であることを確認する。

---

## 31. 定期メンテナンス

## 31.1 毎週またはアラーム発生時

* CloudWatch Alarm確認
* ECS Task停止履歴確認
* Backend errorログ確認
* RDSイベント確認

問題がない場合、毎週必ず手動確認する必要はない。

## 31.2 毎月

* AWS Cost Explorer確認
* AWS Budgets確認
* Cost Anomaly確認
* 不要なECR image削除
* 不要なsnapshot削除
* CloudWatch Log容量確認
* 依存パッケージ更新確認
* GitHub Dependabot等の警告確認
* AWS Health確認
* IAM権限確認

## 31.3 四半期または半年ごと

* RDSリストアテスト
* Terraformからの再構築確認
* Secret変更手順確認
* 障害対応手順の見直し
* Alarm閾値の見直し
* Node.js・NestJS・Prismaのsupport状況確認
* Cognito・ECS・RDSの設定レビュー

---

## 32. RDS Maintenance Window

RDSのMaintenance WindowとBackup Windowは、通常利用が少ない時間帯に設定する。

例：

```text
Backup Window:
JST 03:00前後

Maintenance Window:
JST 04:00前後の別曜日
```

Backup WindowとMaintenance Windowは重複させない。RDSの自動バックアップは指定されたBackup Windowに実行され、Maintenance Windowとは重複できない。

記録日の境界がJST午前5時であるため、実際の利用時間を確認したうえで時間帯を調整する。

---

## 33. Secret・認証情報運用

## 33.1 基本方針

* AWS Access KeyをGitHubへ保存しない
* GitHub ActionsはOIDCを利用する
* DB passwordはSecrets Managerで管理する
* Secretをソースコードへ記載しない
* `.env` をGitへcommitしない
* Cognito Client SecretをSPAへ設定しない

## 33.2 DB password変更

```text
1. 新しいpasswordをRDSへ設定
2. Secrets Managerを更新
3. ECS Serviceを再デプロイ
4. 新TaskのDB接続を確認
5. 旧Taskの停止を確認
```

Secrets Managerの値を更新しても、既に起動しているTaskの環境変数は自動的には変わらないため、新Taskを起動する。

## 33.3 Secret漏えい時

```text
1. 漏えいしたSecretを直ちに無効化・変更
2. Git履歴・ログ・CI出力を確認
3. CloudTrailで利用履歴を確認
4. ECS Taskを再デプロイ
5. 不審なDBアクセスを確認
6. 影響範囲を記録
```

---

## 34. インシデント対応フロー

```text
Alert受信または障害認知
↓
影響範囲を確認
↓
Severity判定
↓
サービス安定化
↓
原因調査
↓
復旧
↓
動作確認
↓
再発防止
↓
記録
```

## 34.1 初動原則

* 変更直後なら直前versionへのロールバックを優先する
* データ損失の可能性がある場合は書き込みを止める
* 原因が不明でも、影響拡大を防ぐ
* 調査のために機密情報をログへ追加しない
* AWS Consoleでの緊急変更は後からTerraformへ反映する

---

## 35. Runbook：APIへアクセスできない

```text
1. CloudFront 5xxErrorRateを確認
2. ALB HealthyHostCountを確認
3. ECS ServiceのRunning Taskを確認
4. ECS Taskの停止理由を確認
5. /api/health を確認
6. Backendログを確認
7. Security Groupを確認
8. RDS接続状態を確認
9. 直前デプロイが原因ならロールバック
```

---

## 36. Runbook：ECS Taskが起動しない

```text
1. ECS Service Eventを確認
2. Task停止理由を確認
3. CloudWatch Logsが作成されているか確認
4. ECR image URI・tagを確認
5. Task Execution Roleを確認
6. Secrets Manager参照権限を確認
7. DATABASE_URL注入を確認
8. CPU・Memory設定を確認
9. コンテナ起動commandを確認
10. 修正後に再デプロイ
```

---

## 37. Runbook：ALB TargetがUnhealthy

```text
1. Health Check pathが /api/health か確認
2. Container Portが3000か確認
3. NestJSが0.0.0.0でlistenしているか確認
4. ECS Security Groupを確認
5. ALB Security Groupを確認
6. Health Check timeout・intervalを確認
7. Backendログを確認
8. TaskのCPU・Memory不足を確認
```

---

## 38. Runbook：RDSへ接続できない

```text
1. RDS Statusを確認
2. ECSとRDSのSecurity Groupを確認
3. DATABASE_URLのendpointを確認
4. username・passwordを確認
5. DB名を確認
6. Port 5432を確認
7. RDS Eventを確認
8. DB接続数を確認
9. Secret変更直後ならECSを再デプロイ
```

---

## 39. Runbook：RDS空き容量低下

```text
1. FreeStorageSpaceを確認
2. DBサイズ増加の原因を確認
3. 不要なデータ・ログtableを確認
4. migrationによる一時データを確認
5. 必要ならstorageを拡張
6. アラーム閾値を再確認
7. 再発防止策を記録
```

緊急時にDBデータを安易に削除しない。

---

## 40. Runbook：ログインできない

```text
1. Cognito Hosted UIへアクセスできるか確認
2. Callback URLを確認
3. Logout URLを確認
4. App Client IDを確認
5. Client Secretなしのpublic clientか確認
6. Authorization Code + PKCE設定を確認
7. CloudFront URL変更の反映を確認
8. ブラウザのnetwork errorを確認
9. Cognito CloudWatch Metricsを確認
10. Userの状態を確認
```

---

## 41. Runbook：デプロイ失敗

```text
1. GitHub Actionsの失敗stepを確認
2. ECR pushの成否を確認
3. migration taskの結果を確認
4. ECS Deployment Eventを確認
5. 新Taskの停止理由を確認
6. ALB Health Checkを確認
7. Circuit Breakerのrollback結果を確認
8. 旧Taskが正常稼働しているか確認
9. 必要なら手動ロールバック
```

---

## 42. Runbook：Cost異常

```text
1. Cost Explorerでサービス別費用を確認
2. Cost Anomalyのroot causeを確認
3. ECS desiredCountを確認
4. RDS instance classと稼働状態を確認
5. ALBの不要な追加作成を確認
6. NAT Gatewayが誤って作成されていないか確認
7. CloudWatch Logs量を確認
8. ECR・snapshot・S3容量を確認
9. 不要リソースを削除
10. 原因と対応を記録
```

---

## 43. Planned Shutdown

学習を中断する場合は、計画停止として以下を行う。

```text
ECS:
desiredCount = 0

RDS:
一時停止

ALB:
長期間利用しない場合は削除

CloudWatch Alarm:
計画停止中は一時的に無効化または通知抑止
```

再開時：

```text
1. RDSを起動
2. RDS Availableを確認
3. ECS desiredCountを1へ戻す
4. ALB Healthyを確認
5. /api/health を確認
6. アラームを再有効化
```

計画停止を障害として通知し続けないよう、停止・再開手順にAlarm制御を含める。

---

## 44. 運用変更管理

## 44.1 原則

AWS構成変更は以下の流れで行う。

```text
GitHub Issueまたは設計判断
↓
Terraform / ecspresso変更
↓
Pull Request
↓
plan・diff確認
↓
apply・deploy
↓
動作確認
```

## 44.2 緊急変更

障害対応でAWS Consoleから変更した場合は、復旧後に以下を行う。

* 変更内容を記録する
* Terraformまたはecspressoへ反映する
* driftを確認する
* 不要な一時設定を戻す

Terraform管理対象をConsoleから継続的に変更しない。

---

## 45. 運用記録

以下をGitHub Issue、Pull Requestまたは運用メモとして残す。

* デプロイ日時
* デプロイしたcommit SHA
* migration内容
* インシデント発生日時
* 影響範囲
* 原因
* 暫定対応
* 恒久対応
* リストア実施結果
* アラーム閾値変更
* AWS構成変更
* コスト異常対応

小さな個人開発では重いチケット管理を導入せず、GitHub上で追跡可能な状態を維持する。

---

## 46. 初期実装スコープ

Stage 1から導入するもの：

* Backend CloudWatch Logs
* Log retention 7日
* ALB Health Check
* ALB基本メトリクス
* ECS CPU・Memory確認
* RDS基本メトリクス
* AWS Budget
* Cost Anomaly Detection
* ECS Deployment Circuit Breaker
* 自動ロールバック
* RDS自動バックアップ
* Manual Snapshot手順
* 基本Runbook

Stage 2で追加するもの：

* CloudWatch Dashboard
* CloudWatch Alarm
* SNSメール通知
* CloudFront監視
* Cognito監視
* ALB Access Logs
* CloudFront Access Logs
* RDS Event Notification
* AWS Health通知
* CloudTrail Trail
* リストアテスト
* GitHub Actionsによる自動デプロイ
* デプロイ後Smoke Test

---

## 47. 初期実装では扱わないもの

* 24時間365日のオンコール
* PagerDuty等の外部インシデント管理
* Datadog
* New Relic
* Sentry
* OpenTelemetry Collector
* AWS X-Ray
* CloudWatch RUM
* CloudWatch Synthetics
* Container Insights
* Managed Grafana
* Amazon OpenSearch Service
* Security Hub CSPM
* GuardDuty
* AWS Config
* AWS Backupによる集中管理
* 自動復旧Lambda
* Chaos Engineering
* Multi-Region監視
* Cross-Region Backup

---

## 48. 将来課題

利用者やシステム規模が増えた場合は、以下を検討する。

* CloudWatch Syntheticsによる外形監視
* CloudWatch RUMによるフロントエンド監視
* OpenTelemetryによる分散トレーシング
* ECS Container Insights
* DatadogまたはSentry
* CloudWatch Embedded Metric FormatによるApplication Metric
* API成功率・記録保存成功率のCustom Metric
* Slack・Microsoft Teams通知
* 自動障害復旧
* 24時間オンコール
* RDS Multi-AZ
* desiredCount 2以上
* Cross-Region Backup
* GuardDuty
* Security Hub
* AWS Config
* WAF
* Secret自動rotation
* 複数環境の統合Dashboard

CloudWatch Embedded Metric Formatを利用すると、構造化JSONログからCustom Metricを抽出し、DashboardやAlarmへ利用できる。

---

## 49. 関連ドキュメント

| ドキュメント                          | 関連内容                   |
| ------------------------------- | ---------------------- |
| `03-api-design.md`              | Health Check、APIエラー    |
| `04-auth-design.md`             | Cognito、token、認証エラー    |
| `05-frontend-design.md`         | CloudFront、フロントエンドエラー  |
| `06-data-items.md`              | 個人情報、健康情報              |
| `07-validation-error-design.md` | エラーレスポンス、ログ出力          |
| `08-state-data-flow.md`         | 401、再ログイン、API失敗        |
| `09-test-viewpoints.md`         | Smoke Test、E2E、障害系テスト  |
| `10-adr.md`                     | 運用・監視に関する設計判断          |
| `11-aws-architecture.md`        | AWSリソース構成、CI/CD、バックアップ |
