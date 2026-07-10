# 健康管理マスター 認証・認可設計書 v0.2

## 1. ドキュメントの目的

本ドキュメントは、健康管理マスターにおける認証・認可の設計方針を整理するための資料である。

本ドキュメントでは、以下を定義する。

* 採用する認証基盤
* ログイン・ログアウト方式
* 認証フロー
* API保護方針
* ユーザー識別方針
* ユーザーごとのデータ分離方針
* 認証エラー・認可エラー時の扱い
* フロントエンドとバックエンドの責務分担
* 初期実装で扱う範囲
* 将来課題

認証画面の細かいUI、APIの詳細仕様、状態管理の実装詳細は、本ドキュメントでは深掘りしない。
それぞれ以下の設計書で扱う。

| 項目              | 扱う資料           |
| --------------- | -------------- |
| 認証画面・画面遷移       | 画面設計書          |
| API仕様           | API設計書         |
| フロントエンド実装方針     | フロントエンド設計書     |
| 認証状態・取得データの管理   | 状態管理・データフロー設計書 |
| エラー文言・表示        | バリデーション・エラー設計書 |
| AWS設定・Cognito設定 | AWS構成メモ        |
| 設計判断の理由         | ADR / 設計判断メモ   |

---

## 2. 認証・認可設計の基本方針

健康管理マスターでは、利用者本人のみが自分の健康記録を管理できることを基本方針とする。

完成形では、以下を満たす。

* 認証済みユーザーのみが記録系画面を利用できる
* 認証済みユーザーのみが記録系APIを利用できる
* ユーザーは自分の記録のみ取得・登録・更新・削除できる
* APIリクエストで任意の `userId` を指定させない
* バックエンド側で認証済みユーザーを特定する
* バックエンド側で必ずユーザー単位のデータ制御を行う
* 認証は自作せず、Cognitoに委ねる

---

## 3. 採用する認証基盤

認証基盤には **Amazon Cognito User Pool** を利用する。

Cognito User Pool を利用する目的は以下である。

* パスワード管理をアプリケーション側で直接持たない
* サインイン・サインアウト・パスワードリセット等の認証機能をCognitoに委ねる
* OAuth / OIDC に沿った認証フローを利用する
* Cognitoが発行するJWTを使ってAPIを保護する
* 将来的にGoogleログインなどの外部IDプロバイダー連携に拡張しやすくする
* AWS構成との親和性を高める

---

## 4. 採用するログイン方式

## 4.1 基本方針

ログイン方式は **Cognito Hosted UI** を採用する。

アプリケーション側では、メールアドレス・パスワード入力画面を自作しない。

```text
採用する方式:
React SPA → Cognito Hosted UI → React SPAへ戻る
```

理由：

* 素早く認証機能を完成させられる
* パスワード入力画面・パスワードリセット等を自作しなくてよい
* 認証の責務をCognitoへ寄せられる
* 独自認証実装によるセキュリティリスクを避けやすい
* 今回の目的であるアプリ本体の設計・実装学習に集中できる

## 4.2 採用しない方式

初期実装では、以下は採用しない。

| 方式                    | 採用しない理由                                        |
| --------------------- | ---------------------------------------------- |
| 独自ログイン画面 + Cognito    | Hosted UIより実装範囲が増えるため、今回は採用しない                 |
| 完全独自JWT認証             | パスワード管理・refresh token管理・失効管理等の責務が重いため、今回は採用しない |
| BFF + HttpOnly Cookie | セキュリティ上は有力だが、初期実装としては構成が重いため、将来課題とする           |

---

## 5. OAuth / OIDC フロー

## 5.1 採用フロー

Cognito Hosted UI では、以下のフローを利用する。

```text
Authorization Code Grant + PKCE
```

SPAはブラウザ上で動作するpublic clientであり、client secretを安全に保持できない。
そのため、Cognito App Clientでは **client secretを利用しない**。

PKCEはpublic client向けのAuthorization Code Grant拡張であり、認可コード横取りリスクを下げるために利用する。

## 5.2 認証フロー概要

```mermaid
sequenceDiagram
  participant User as 利用者
  participant FE as React SPA
  participant Cognito as Cognito Hosted UI
  participant BE as NestJS API
  participant DB as DB

  User->>FE: ログインボタン押下
  FE->>Cognito: Hosted UIへリダイレクト
  Cognito-->>User: ログイン画面表示
  User->>Cognito: 認証情報入力
  Cognito-->>FE: 認証後callback URLへリダイレクト
  FE->>FE: Amplify Authが認証セッションを取得
  FE->>BE: Authorization: Bearer access_token
  BE->>BE: Cognito JWT検証
  BE->>DB: cognitoSubでUser検索
  DB-->>BE: User
  BE-->>FE: APIレスポンス
```

---

## 6. フロントエンド認証ライブラリ

## 6.1 採用ライブラリ

フロントエンドでは **Amplify Auth** を利用する。

Amplify Auth の役割は以下である。

* Cognito Hosted UIへのリダイレクト
* Hosted UIから戻った後の認証状態取得
* 認証済みユーザー情報の取得
* access token / ID token の取得
* セッション更新
* サインアウト処理

## 6.2 ログイン開始

ログインボタン押下時は、Amplify AuthからCognito Hosted UIへリダイレクトする。

実装イメージ：

```ts
import { signInWithRedirect } from 'aws-amplify/auth';

await signInWithRedirect();
```

## 6.3 認証済みセッション取得

API呼び出し前に、Amplify Authから認証済みセッションを取得する。

実装イメージ：

```ts
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession();
const accessToken = session.tokens?.accessToken?.toString();
```

---

## 7. 利用するtoken

Cognito認証後に取得する主なtokenは以下である。

| token         | 用途                                |
| ------------- | --------------------------------- |
| Access Token  | APIアクセスの認可に利用する                   |
| ID Token      | フロントエンドでユーザー属性を参照するために利用する        |
| Refresh Token | Access Token / ID Token の再取得に利用する |

API認証には **Access Token** を利用する。

ID Tokenはユーザー属性や個人情報を含み得るため、API認可のためには利用しない。

---

## 8. API認証方式

## 8.1 基本方式

記録系APIでは、HTTP AuthorizationヘッダーにCognito Access Tokenを付与する。

```http
Authorization: Bearer <access_token>
```

バックエンドは、受け取ったAccess Tokenを検証し、認証済みユーザーを特定する。

## 8.2 認証必須API

以下のAPIは認証必須とする。

* 食事記録API
* 体調記録API
* 筋トレ記録API
* 履歴API

## 8.3 認証不要API

以下のAPIは認証不要とする。

* ヘルスチェックAPI
* Cognito Hosted UIからのcallbackを受けるフロントエンドルート
* 公開される静的ファイル

---

## 9. バックエンドでのJWT検証

## 9.1 基本方針

初期実装では、NestJSバックエンドでCognito JWTを検証する。

JWT検証では、Cognito User Poolから取得できる公開鍵情報を利用し、受け取ったtokenが正当なCognito User Poolから発行されたものであることを確認する。

## 9.2 検証項目

バックエンドでは、Access Tokenについて以下を検証する。

* JWT形式が正しいこと
* 署名が正しいこと
* 有効期限が切れていないこと
* issuer が想定するCognito User Poolであること
* token_use が `access` であること
* client_id が想定するCognito App Clientであること
* 必要に応じてscopeが適切であること

## 9.3 JWT検証後の扱い

JWT検証に成功した場合、バックエンドはtokenのclaimから `sub` を取得する。

取得した `sub` をもとに、アプリケーションDBのUserを特定する。

```text
Cognito access token sub
↓
User.cognitoSub
↓
User.id
```

---

## 10. ユーザー識別方針

## 10.1 基本方針

アプリケーション内部では、Cognitoの `sub` を外部認証IDとして扱う。

`sub` はCognito上のユーザーを識別するための一意なIDである。
`username` はCognito User Pool上のユーザー名であり、アプリケーションDBとの紐づけキーとしては `sub` を優先する。

基本方針は以下とする。

* Cognitoの `sub` を外部認証IDとして扱う
* アプリケーションDBの `User.cognitoSub` と紐づける
* 記録系データはアプリケーションDBの `User.id` に紐づける
* APIリクエストでは `userId` を受け取らない
* バックエンドが認証済みtokenからUserを解決する

## 10.2 User解決の流れ

```mermaid
flowchart TD
  Request["API Request"] --> AuthHeader["Authorization Header"]
  AuthHeader --> VerifyToken["Access Token 検証"]
  VerifyToken --> GetSub["Cognito sub 取得"]
  GetSub --> FindUser["User.cognitoSub でUser検索"]
  FindUser --> CurrentUser["request.currentUser に設定"]
  CurrentUser --> Controller["Controller / Service"]
```

## 10.3 初回ログイン時のUser作成

初回ログイン後、アプリケーションDBにUserが存在しない場合は、初回APIアクセス時にUserを作成する。

初期実装では、以下の方式を採用する。

```text
初回APIアクセス時にUserを自動作成する
```

理由：

* 初期利用者は本人のみ
* Cognito側のユーザーとアプリDBのUserを同期する実装をシンプルにできる
* Cognitoトリガー等を使うより初期実装の範囲を抑えられる

User作成時に保存する候補は以下。

| 項目         | 内容                               |
| ---------- | -------------------------------- |
| cognitoSub | Cognitoのsub                      |
| email      | ID TokenまたはUserInfoから取得するメールアドレス |
| name       | 取得できる場合のみ保存                      |
| createdAt  | 作成日時                             |
| updatedAt  | 更新日時                             |

emailやnameの取得元、必須/任意、更新タイミングはデータ項目定義書で扱う。

---

## 11. 認可方針

## 11.1 基本方針

認可では、認証済みユーザーが自分の記録のみ操作できることを保証する。

対象データは以下。

* 食事記録
* 体調記録
* 筋トレ記録
* 履歴表示用データ

## 11.2 データアクセス制御

記録系データの取得・登録・更新・削除では、必ず認証済みユーザーの `User.id` を条件に含める。

```text
where: {
  userId: currentUser.id,
  recordDate: 指定日
}
```

フロントエンドから送られた任意の `userId` は利用しない。

## 11.3 ロール設計

初期実装では、ロールは導入しない。

理由：

* 初期利用者は本人のみ
* 管理者画面は対象外
* 他ユーザーとの共有機能は対象外
* 権限階層を作る必要がない

将来的に管理者機能、共有機能、閲覧専用権限が必要になった場合に、Cognito User Pool Groupやアプリケーション側ロールの導入を検討する。

---

## 12. 画面アクセス制御

## 12.1 画面ごとの認証要否

| 画面                | 認証要否 | 備考                      |
| ----------------- | ---- | ----------------------- |
| ログイン画面            | 不要   | ログイン開始ボタンを表示する          |
| Cognito Hosted UI | 不要   | Cognitoが提供する認証画面        |
| Callback処理ルート     | 不要   | Cognito認証後にReact SPAへ戻る |
| 日次記録画面            | 必要   | 認証済みユーザーのみ              |
| 履歴画面              | 必要   | 認証済みユーザーのみ              |
| 未定義ルート            | 不要   | ルーティング方針は画面設計書で扱う       |

## 12.2 未ログイン時の挙動

未ログイン状態で認証必須画面へアクセスした場合は、ログイン画面へ遷移する。

```mermaid
flowchart TD
  Access["認証必須画面へアクセス"] --> CheckAuth{"認証済み？"}
  CheckAuth -->|Yes| ShowPage["画面表示"]
  CheckAuth -->|No| RedirectLogin["ログイン画面へ遷移"]
```

## 12.3 認証済みユーザーがログイン画面へアクセスした場合

認証済みユーザーがログイン画面へアクセスした場合は、日次記録画面へ遷移する。

```text
/ → /daily
```

---

## 13. ログイン設計

## 13.1 ログイン画面の役割

アプリ側のログイン画面は、メールアドレス・パスワード入力フォームを持たない。

ログイン画面には、Cognito Hosted UIへ遷移するためのログインボタンを配置する。

画面イメージ：

```text
健康管理マスター

[ログインする]
```

## 13.2 ログイン開始

利用者がログインボタンを押下すると、Amplify Auth経由でCognito Hosted UIへ遷移する。

```text
ログインボタン押下
↓
signInWithRedirect()
↓
Cognito Hosted UI
```

## 13.3 ログイン成功後の遷移

ログイン成功後は、Cognitoのcallback URLを経由してReact SPAへ戻る。

React SPA側で認証状態を確認し、日次記録画面へ遷移する。

```text
Cognito callback
↓
React SPA
↓
/daily
```

---

## 14. ログアウト設計

## 14.1 基本方針

利用者は画面上のログアウト操作によりログアウトできる。

ログアウト時には以下を行う。

* Amplify AuthのsignOutを実行する
* Cognitoのログアウト処理を行う
* フロントエンド側の認証状態を破棄する
* 取得済み記録データ・フォーム状態を破棄する
* ログイン画面へ遷移する

## 14.2 ログアウト後の遷移

ログアウト後はログイン画面へ遷移する。

```text
/logout
↓
/
```

## 14.3 ログアウト後のデータ扱い

ログアウト後は、前ユーザーの記録データを画面上に残さない。

破棄対象は以下。

* 認証状態
* API clientの認証情報
* 取得済み記録データ
* フォーム入力中データ
* エラー状態
* ローディング状態

詳細は状態管理・データフロー設計書で扱う。

---

## 15. Cognito設定方針

## 15.1 User Pool

Cognito User Poolを作成する。

初期実装では、ユーザー登録は不特定多数に公開しない。

```text
self sign-up: 無効
ユーザー作成: Cognito管理画面から手動作成
```

理由：

* 初期利用者は本人のみ
* サインアップ画面を実装しない
* 不正登録・スパム登録を考慮しなくてよい
* 認証導入を早く完了できる

## 15.2 App Client

SPA用のCognito App Clientを作成する。

設定方針：

* public clientとして作成する
* client secretは利用しない
* Authorization Code Grantを有効にする
* PKCEを利用する
* callback URLを設定する
* logout URLを設定する

## 15.3 Callback URL / Logout URL

環境ごとにcallback URL / logout URLを設定する。

| 環境         | Callback URL                              | Logout URL               |
| ---------- | ----------------------------------------- | ------------------------ |
| local      | `http://localhost:5173/` または callback用ルート | `http://localhost:5173/` |
| production | 本番フロントエンドURL                              | 本番フロントエンドURL             |

具体的なURLはAWS構成メモで管理する。

## 15.4 MFA

初期実装では、MFAは必須にしない。

理由：

* 初期利用者は本人のみ
* 認証実装を早く完了させる
* MFA導入による画面・検証パターン増加を避ける

将来的に本番公開・個人情報保護を重視する段階で、MFAを再検討する。

## 15.5 パスワードリセット

パスワードリセットはCognito Hosted UIの機能に委ねる。

アプリケーション側では、パスワードリセット画面を自作しない。

---

## 16. token保存方針

## 16.1 初期実装方針

初期実装では、Amplify Authの標準的なtoken管理に寄せる。

初期実装では、以下を優先する。

* 認証機能を素早く完成させる
* Amplify Authの標準機能を活用する
* 自前でrefresh token管理を実装しない
* token更新処理を自作しない

## 16.2 セキュリティ上の注意

`localStorage` 等、JavaScriptから参照可能な保存先にtokenを保存する場合、XSS成立時にtokenを盗まれるリスクがある。

そのため、初期実装ではAmplify Auth標準に寄せるが、以下を将来課題として残す。

* `sessionStorage` への変更
* memory storageへの変更
* access tokenのメモリ保持
* refresh tokenのHttpOnly Cookie化
* BFF構成
* CSPなどXSS対策の強化

## 16.3 今回採用しないtoken管理方式

初期実装では、以下は採用しない。

| 方式                                   | 理由                               |
| ------------------------------------ | -------------------------------- |
| refresh tokenをHttpOnly Cookieに保存する方式 | セキュリティ上は有力だが、BFF寄り構成になり実装範囲が増える  |
| access tokenを完全にメモリ保持する方式            | リロード時の復元やセッション更新設計が増える           |
| 完全自前のtoken管理                         | Amplify Authの責務と重複し、初期実装の目的から外れる |

---

## 17. 認証・認可エラー設計

## 17.1 401 Unauthorized

401は、認証されていない、または認証情報が無効な場合に返す。

発生例：

* Authorizationヘッダーがない
* Access Tokenが不正
* Access Tokenの有効期限切れ
* issuerが不正
* token_useが不正
* client_idが不正

画面側の扱い：

* 認証状態を再確認する
* 必要に応じて認証状態を破棄する
* ログイン画面へ遷移する
* 必要に応じて「再ログインしてください」と表示する

## 17.2 403 Forbidden

403は、認証はされているが操作権限がない場合に返す。

発生例：

* 他ユーザーのデータへアクセスしようとした
* 将来的なロール制御で権限不足になった

画面側の扱い：

* ログイン画面へ戻すのではなく、権限エラーとして表示する
* 対象操作を中断する

## 17.3 404 Not Foundとの使い分け

認証済みユーザーの記録が存在しないことは、通常ケースとして扱う。
そのため、未登録日の記録取得は原則として404にしない。

一方で、存在しないAPIパスや、エラーとして扱うべきリソース未存在は404とする。

---

## 18. Userデータ設計方針

認証・認可に関わるUserデータは以下の考え方で扱う。

| 項目         | 用途                   |
| ---------- | -------------------- |
| id         | アプリケーション内部のユーザーID    |
| cognitoSub | Cognitoユーザーを識別する外部ID |
| email      | ユーザーのメールアドレス         |
| name       | 表示名                  |
| createdAt  | 作成日時                 |
| updatedAt  | 更新日時                 |

基本方針：

* 記録データは内部の `User.id` に紐づける
* Cognitoとの紐づけには `cognitoSub` を使う
* `cognitoSub` は一意とする
* emailは表示・識別補助として扱う
* emailだけを主キー的に扱わない

詳細なDB項目、型、必須/任意、unique制約はデータ項目定義書で扱う。

---

## 19. データ分離方針

記録データは、必ず認証済みユーザーに紐づけて扱う。

対象データ：

* 食事記録
* 体調記録
* 筋トレ記録

データアクセス時は、以下の条件を必ず含める。

```text
userId = currentUser.id
recordDate = 指定された記録日
```

この方針により、他ユーザーの記録を取得・更新・削除できないようにする。

---

## 20. セキュリティ方針

認証・認可に関するセキュリティ方針は以下とする。

* パスワードをアプリケーションDBに保存しない
* ログイン画面はCognito Hosted UIに委ねる
* client secretをブラウザに持たせない
* APIではAccess Tokenを検証する
* ID TokenをAPI認可に利用しない
* userIdをクライアントから任意に指定させない
* 認可チェックをフロントエンドだけに依存しない
* 記録系APIはすべて認証必須とする
* CORSは許可するフロントエンドドメインを限定する
* 本番環境ではSwagger公開範囲を制限する
* エラーレスポンスにtokenや内部情報を含めない

---

## 21. 実装責務の分離

| 領域                | 主な責務                                                 |
| ----------------- | ---------------------------------------------------- |
| Cognito User Pool | ユーザー認証、Hosted UI、token発行、パスワードリセット                   |
| Amplify Auth      | Hosted UIへのリダイレクト、認証状態取得、token取得、サインアウト              |
| フロントエンド           | ログイン導線、認証状態管理、Private Route、Authorizationヘッダー付与      |
| バックエンド            | JWT検証、User解決、認可チェック、currentUser管理                    |
| DB                | Userと記録データの紐づけ、一意制約                                  |
| API設計書            | 認証必須APIの方針整理                                         |
| フロントエンド設計書        | AuthProvider、Private Route、API client、token取得        |
| 状態管理・データフロー設計書    | ログイン後・ログアウト後・401後の状態遷移                               |
| バリデーション・エラー設計書    | 401 / 403 の表示文言・エラー形式                                |
| AWS構成メモ           | Cognito User Pool、App Client、callback URL、logout URL |

---

## 22. 初期実装スコープ

初期実装で行うことは以下。

* Cognito User Poolを作成する
* Cognito App Clientを作成する
* Cognito Hosted UIを有効にする
* Authorization Code Grant + PKCEを利用する
* client secretを使わない
* Amplify Authをフロントエンドに導入する
* ログインボタンからHosted UIへ遷移する
* ログイン後にReact SPAへ戻る
* Amplify AuthからAccess Tokenを取得する
* API呼び出し時にAuthorizationヘッダーを付与する
* NestJSバックエンドでCognito JWTを検証する
* Cognito subからUserを解決する
* 記録系APIを認証済みUser単位で制御する
* ログアウトできるようにする

---

## 23. 初期実装では扱わないこと

初期実装では以下を扱わない。

* 独自ログイン画面
* 完全独自JWT認証
* BFF + HttpOnly Cookie構成
* アプリ側のサインアップ画面
* 管理者画面
* ロール制御
* MFA必須化
* Googleログイン
* refresh tokenの独自管理
* token rotationの詳細制御
* API Gateway JWT Authorizer
* CognitoトリガーによるUser自動作成

---

## 24. 将来課題

## 24.1 token保存方式の見直し

初期実装ではAmplify Auth標準に寄せるが、セキュリティを強化する段階で以下を検討する。

* `localStorage` 以外の保存方式
* `sessionStorage`
* memory storage
* refresh tokenのHttpOnly Cookie化
* BFF構成
* CSP強化
* XSS対策強化

## 24.2 API Gateway JWT Authorizer

AWS本番構成でAPI Gatewayを導入する場合、JWT検証をAPI Gateway側に寄せる構成を検討する。

初期実装ではNestJSバックエンドでJWTを検証する。

## 24.3 MFA

本番公開・個人情報保護を重視する段階で、MFAの有効化を検討する。

## 24.4 外部IDプロバイダー連携

将来的にGoogleログインなどを導入する場合は、Cognitoの外部IDプロバイダー連携を検討する。

## 24.5 User同期方式

初期実装では初回APIアクセス時にUserを作成する。
将来的にユーザー属性同期やサインアップ直後の初期処理が必要になった場合、Cognitoトリガーや専用同期処理を検討する。

---

## 25. 後続設計書への引き継ぎ

| 後続資料           | 引き継ぐ内容                                                         |
| -------------- | -------------------------------------------------------------- |
| 画面設計書          | ログイン画面、Hosted UIへの遷移、認証済み/未認証時の画面遷移                            |
| API設計書         | Authorizationヘッダー前提、認証必須API                                    |
| フロントエンド設計書     | Amplify Auth、AuthProvider、Private Route、API client、token取得     |
| 状態管理・データフロー設計書 | 認証状態、API取得状態、401時の状態破棄、ログアウト時のキャッシュ破棄                          |
| データ項目定義書       | User.cognitoSub、email、name、Userと記録データの関連                       |
| バリデーション・エラー設計書 | 401 / 403 のエラー形式、画面表示文言                                        |
| テスト観点表         | 未ログインアクセス、ログイン後アクセス、JWT不正、他ユーザーデータ分離                           |
| AWS構成メモ        | Cognito User Pool、App Client、Hosted UI、Callback URL、Logout URL |
| ADR / 設計判断メモ   | Cognito Hosted UI採用、独自認証をしない判断、初期実装でBFFを採用しない判断                |
