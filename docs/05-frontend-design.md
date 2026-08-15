# 健康管理マスター フロントエンド設計書 v0.1

## 1. ドキュメントの目的

本ドキュメントは、健康管理マスターにおけるフロントエンドの設計方針を整理するための資料である。

本ドキュメントでは、以下を定義する。

* フロントエンドの基本構成
* ルーティング方針
* 認証状態の扱い
* API通信方針
* 状態管理方針
* フォーム管理方針
* ディレクトリ構成
* コンポーネント設計方針
* エ ディレクトリ構成
* コンポーネント設計方針
* エラー・ローディング方針
* 日付処理方針
* 初期実装スコープ
* 将来課題

本ドキュメントは、現状の仮実装ではなく、完成形のフロントエンド方針を定義する。

> **v2に関する注記**
> UI実装方針は v2 で更新している（デザイントークン＋CSS Modules、共通UIコンポーネント群、グラフに Recharts・アイコンに lucide-react を採用、日付選択は react-calendar のポップオーバー、履歴画面の遅延ロードによるバンドル分割など）。UI/コンポーネント・スタイリングに関する最新方針は「UI設計書 v2（14）」を参照すること（→14参照）。ルーティング・認証状態・API通信の基本方針は本書のまま有効。

---

## 2. フロントエンド設計の前提

## 2.1 技術スタック

フロントエンドは以下の技術で構成する。

| 項目      | 採用技術                           |
| ------- | ------------------------------ |
| フレームワーク | React                          |
| 言語      | TypeScript                     |
| ビルドツール  | Vite                           |
| ルーティング  | React Router                   |
| 認証連携    | Amplify Auth                   |
| 認証基盤    | Amazon Cognito User Pool       |
| ログイン画面  | Cognito Managed Login              |
| API通信   | fetchベースの共通API client          |
| 状態管理    | useState / useEffect / Context |
| フォーム管理  | useState                       |
| UIライブラリ | 初期実装では導入しない                    |

## 2.2 アプリケーション形式

本アプリケーションは、React + Viteで構成するSPAとして扱う。

SPAでは、初回に `index.html` とJavaScriptを読み込み、その後の画面切り替えはReact Routerによってクライアント側で行う。

```text id="spa-routing-basic"
初回アクセス:
index.html を読み込む

画面遷移:
React Routerが表示コンポーネントを切り替える
```

---

## 3. フロントエンド設計の基本方針

フロントエンドでは、以下の方針を基本とする。

* 画面単位の責務を明確にする
* API通信処理を画面コンポーネントへ直接書きすぎない
* 認証状態はContextで管理する
* API通信は共通API clientを経由する
* フォーム状態は初期実装ではuseStateで管理する
* 状態管理ライブラリは初期実装では導入しない
* 複雑化した場合はTanStack QueryやReact Hook Form / Zodの導入を検討する
* 現在日付の算出はJST午前5時境界を考慮する

---

## 4. 画面構成

## 4.1 画面一覧

| 画面ID    | パス         | 画面名    | 認証要否 |
| ------- | ---------- | ------ | ---- |
| SCR-001 | `/`        | ログイン画面 | 不要   |
| SCR-002 | `/daily`   | 日次記録画面 | 必要   |
| SCR-003 | `/history` | 履歴画面   | 必要   |
| SCR-004 | `*`        | 未定義ルート | 不要   |

## 4.2 画面ごとの役割

| 画面     | 主な役割                               |
| ------ | ---------------------------------- |
| ログイン画面 | Cognito Managed Loginへ遷移するログインボタンを表示する |
| 日次記録画面 | 食事・体調・筋トレ記録を日付単位で入力・保存する           |
| 履歴画面   | 月次カレンダー、記録あり日付、日次詳細、日次一括削除を扱う      |
| 未定義ルート | 不正なURLにアクセスした場合の遷移を扱う              |

---

## 5. ルーティング設計

## 5.1 基本方針

ルーティングにはReact Routerを利用する。

認証が必要な画面は、認証状態を確認したうえで表示する。

```text id="routing-policy"
認証不要:
/

認証必要:
/daily
/history
```

## 5.2 ルート定義イメージ

```tsx id="route-image"
<Routes>
  <Route path="/" element={<LoginPage />} />

  <Route element={<PrivateRoute />}>
    <Route path="/daily" element={<DailyPage />} />
    <Route path="/history" element={<HistoryPage />} />
  </Route>

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

## 5.3 PrivateRouteの責務

`PrivateRoute` は、認証必須画面へのアクセス制御を担当する。

主な責務は以下。

* 認証状態を確認する
* 認証確認中はローディングを表示する
* 認証済みの場合は対象画面を表示する
* 未認証の場合はログイン画面へ遷移する

```text id="private-route-flow"
認証確認中
↓
ローディング表示

認証済み
↓
対象画面表示

未認証
↓
ログイン画面へ遷移
```

---

## 6. 認証状態管理

## 6.1 基本方針

認証状態は `AuthContext` で管理する。

`AuthContext` は、アプリ全体で認証状態を参照できるようにするためのContextである。

## 6.2 AuthContextの責務

`AuthContext` の主な責務は以下。

* 認証済みかどうかを管理する
* 認証確認中かどうかを管理する
* ログイン開始処理を提供する
* ログアウト処理を提供する
* 認証済みユーザー情報を保持する
* 認証状態の初期確認を行う

## 6.3 AuthContextが提供する値

```ts id="auth-context-type"
type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: AuthUser | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
};
```

## 6.4 ログイン処理

ログイン処理では、Amplify Authを利用してCognito Managed Loginへ遷移する。

```text id="login-flow"
login()
↓
signInWithRedirect()
↓
Cognito Managed Login
```

ログイン画面自体はCognito Managed Loginが提供するため、React側ではメールアドレス・パスワード入力フォームを持たない。

## 6.5 ログアウト処理

ログアウト処理では、Amplify AuthのsignOutを利用する。

ログアウト時には以下を行う。

* Cognitoからサインアウトする
* フロントエンド上の認証状態を破棄する
* 取得済みデータを破棄する
* ログイン画面へ遷移する

---

## 7. API通信設計

## 7.1 基本方針

API通信は共通API clientを経由して行う。

画面コンポーネントから直接 `fetch` を呼び出すことは避ける。

```text id="api-client-policy"
画面コンポーネント
↓
カスタムhook
↓
API client
↓
Backend API
```

理由：

* API通信処理を一箇所に集約できる
* Authorizationヘッダー付与を共通化できる
* Base URL管理を共通化できる
* エラー処理を共通化できる
* 画面コンポーネントの責務を軽くできる

## 7.2 API clientの責務

API clientは、バックエンドAPIとの通信を担当する。

主な責務は以下。

* Base URLを管理する
* `Content-Type: application/json` を付与する
* Amplify AuthからAccess Tokenを取得する
* `Authorization: Bearer <access_token>` を付与する
* HTTPメソッドを指定する
* query parameterを組み立てる
* request bodyをJSONへ変換する
* response bodyをJSONとしてparseする
* 401 / 403 / 500などの共通エラーを扱う
* 各画面からfetchの詳細を隠す

## 7.3 Access Token取得方針

API clientは、認証必須APIを呼び出す前にAmplify Authから認証セッションを取得する。

```ts id="get-access-token-image"
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession();
const accessToken = session.tokens?.accessToken?.toString();
```

取得したAccess TokenをAuthorizationヘッダーに付与する。

```http id="authorization-header"
Authorization: Bearer <access_token>
```

## 7.4 API client構成イメージ

```ts id="api-client-image"
type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  requiresAuth?: boolean;
};

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  // Base URL生成
  // query parameter組み立て
  // headers生成
  // requiresAuthの場合はaccess token取得
  // fetch実行
  // エラーハンドリング
  // JSON parse
}
```

## 7.5 認証必須APIの呼び出し

認証必須APIでは、`requiresAuth: true` を指定する。

```ts id="api-auth-required"
await apiRequest<Meal | null>('/api/meals', {
  method: 'GET',
  query: { date },
  requiresAuth: true,
});
```

## 7.6 認証不要APIの呼び出し

ヘルスチェックなど、認証不要APIではAccess Tokenを付与しない。

```ts id="api-auth-not-required"
await apiRequest<{ status: string }>('/api/health', {
  method: 'GET',
  requiresAuth: false,
});
```

---

## 8. APIごとの呼び出し責務

## 8.1 API関数の分離

API clientの上に、リソースごとのAPI関数を定義する。

```text id="api-layer"
apiClient
↓
mealApi / conditionApi / workoutApi / historyApi
↓
hooks
↓
pages
```

## 8.2 API関数一覧

| ファイル                | 主な関数                                                         |
| ------------------- | ------------------------------------------------------------ |
| `api/meals.ts`      | `getMealByDate`, `saveMeal`                                  |
| `api/conditions.ts` | `getConditionByDate`, `saveCondition`                        |
| `api/workouts.ts`   | `getWorkoutByDate`, `saveWorkout`                            |
| `api/history.ts`    | `getMonthlyHistory`, `getDailyHistory`, `deleteDailyRecords` |

## 8.3 API関数の例

```ts id="meal-api-image"
export async function getMealByDate(date: string): Promise<Meal | null> {
  return apiRequest<Meal | null>('/api/meals', {
    method: 'GET',
    query: { date },
    requiresAuth: true,
  });
}

export async function saveMeal(input: SaveMealInput): Promise<Meal> {
  return apiRequest<Meal>('/api/meals', {
    method: 'POST',
    body: input,
    requiresAuth: true,
  });
}
```

---

## 9. 状態管理方針

## 9.1 初期実装方針

初期実装では、React標準の以下を中心に状態管理を行う。

* `useState`
* `useEffect`
* `Context`

外部状態管理ライブラリは初期実装では導入しない。

理由：

* 画面数が少ない
* 状態の種類が限定的
* まず完成させることを優先する
* 依存パッケージを増やさず保守コストを抑えられる

## 9.2 管理する状態

| 状態        | 管理場所                      |
| --------- | ------------------------- |
| 認証状態      | AuthContext               |
| 日次記録画面の日付 | DailyPage                 |
| 食事フォーム状態  | MealFormまたはDailyPage      |
| 体調フォーム状態  | ConditionFormまたはDailyPage |
| 筋トレフォーム状態 | WorkoutFormまたはDailyPage   |
| 履歴画面の表示年月 | HistoryPage               |
| 履歴画面の選択日付 | HistoryPage               |
| API取得結果   | 各pageまたはcustom hook       |
| ローディング状態  | 各pageまたはcustom hook       |
| エラー状態     | 各pageまたはcustom hook       |

## 9.3 将来課題

API取得・再取得・キャッシュ・ローディング・エラー管理が複雑になった場合は、TanStack Queryの導入を検討する。

TanStack Query導入時に置き換え候補となる処理は以下。

* API取得状態管理
* ローディング管理
* エラー管理
* 再取得処理
* 保存後の再取得
* 月次履歴のキャッシュ
* 日次詳細のキャッシュ

---

## 10. カスタムhook設計

## 10.1 基本方針

画面コンポーネントからAPI通信や状態更新の詳細を分離するため、必要に応じてカスタムhookを作成する。

## 10.2 hook候補

| hook                 | 役割                     |
| -------------------- | ---------------------- |
| `useAuth`            | AuthContextを利用する       |
| `useDailyRecords`    | 日次記録画面の取得・保存を扱う        |
| `useHistoryRecords`  | 履歴画面の月次・日次取得を扱う        |
| `useTodayRecordDate` | JST午前5時境界を考慮した記録日を取得する |
| `useAsyncAction`     | 保存・削除などの非同期処理状態を扱う     |

## 10.3 useDailyRecordsの責務

`useDailyRecords` は、日次記録画面で必要なAPI通信と状態管理を扱う。

主な責務は以下。

* 指定日の食事記録を取得する
* 指定日の体調記録を取得する
* 指定日の筋トレ記録を取得する
* 食事記録を保存する
* 体調記録を保存する
* 筋トレ記録を保存する
* 取得中・保存中状態を管理する
* エラー状態を管理する

---

## 11. フォーム管理方針

## 11.1 初期実装方針

初期実装では、フォーム状態は `useState` で管理する。

理由：

* 入力項目数が多すぎない
* 複雑なネストフォームではない
* まず完成させることを優先する
* React Hook Form / Zod導入前に、素のフォーム管理を理解できる

## 11.2 フォームの種類

| フォーム      | 主な項目                   |
| --------- | ---------------------- |
| 食事記録フォーム  | カロリー、PFC、カルシウム、メモ      |
| 体調記録フォーム  | 体重、ウエスト、腕周り、睡眠時間、体調スコア |
| 筋トレ記録フォーム | 筋トレメモ                  |

## 11.3 入力値の扱い

HTMLのinputから取得される値は基本的に文字列である。

数値項目は、保存時にnumberへ変換する。

```text id="form-value-policy"
入力中:
stringとして保持

保存時:
numberまたはnullへ変換
```

理由：

* 入力途中の空文字を扱いやすい
* 小数点入力途中の状態を壊しにくい
* フォーム表示とAPI送信値を分離しやすい

## 11.4 フォーム初期化

APIから既存記録を取得した場合は、取得結果をフォーム表示用stateに変換する。

記録が存在しない場合は、空フォームを表示する。

```text id="form-initialize"
API結果あり
↓
フォームstateへ反映

API結果なし
↓
空フォームを表示
```

## 11.5 リセット処理

フォームのリセットは、画面上の入力値を初期状態へ戻す操作とする。

DB上の記録削除とは区別する。

```text id="reset-policy"
リセット:
画面上の入力値をクリアする

削除:
DB上の日次記録を削除する
```

## 11.6 将来課題

バリデーションやフォーム項目が複雑になった場合は、React Hook Form / Zodの導入を検討する。

導入候補となるタイミングは以下。

* 入力項目が増える
* バリデーションが複雑になる
* エラーメッセージ表示を統一したい
* API request schemaとフロント側validation schemaを近づけたい
* フォームの再利用性を高めたい

---

## 12. 型定義方針

## 12.1 基本方針

TypeScriptの型定義により、画面・API・フォーム間のデータ構造を明確にする。

型定義は、以下に分類する。

| 分類            | 内容             |
| ------------- | -------------- |
| API response型 | バックエンドから返るデータ  |
| API request型  | バックエンドへ送信するデータ |
| Form state型   | 画面入力中の状態       |
| View model型   | 画面表示用に加工したデータ  |
| Auth型         | 認証済みユーザー情報     |

## 12.2 型定義ファイル

| ファイル                 | 内容     |
| -------------------- | ------ |
| `types/api.ts`       | API共通型 |
| `types/meal.ts`      | 食事記録型  |
| `types/condition.ts` | 体調記録型  |
| `types/workout.ts`   | 筋トレ記録型 |
| `types/history.ts`   | 履歴型    |
| `types/auth.ts`      | 認証関連型  |

## 12.3 Form stateとAPI requestの分離

Form stateとAPI requestは分離する。

理由：

* input値はstringで扱うことが多い
* APIにはnumberとして送る必要がある
* 空文字、未入力、nullの扱いを明確にできる
* 画面都合とAPI都合を混ぜない

例：

```ts id="form-api-type-separate"
type MealFormState = {
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  calcium: string;
  memo: string;
};

type SaveMealInput = {
  recordDate: string;
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  calcium?: number | null;
  memo?: string | null;
};
```

---

## 13. 日付処理方針

## 13.1 基本方針

健康管理マスターでは、記録日の境界をJST午前5時とする。

フロントエンドでは、初期表示の日付を算出する際にJST午前5時境界を考慮する。

```text id="date-boundary"
JST 05:00以降:
当日扱い

JST 00:00〜04:59:
前日扱い
```

## 13.2 APIに送信する日付形式

APIに送信する記録日は、以下の形式とする。

```text id="date-format"
YYYY-MM-DD
```

## 13.3 日付処理の責務

| 処理          | 責務                        |
| ----------- | ------------------------- |
| 今日の記録日算出    | フロントエンド                   |
| 日付選択        | 画面コンポーネント                 |
| APIへ送る日付形式  | API clientまたはhook         |
| DB上の日付保持    | バックエンド / DB               |
| タイムゾーン変換の詳細 | データ項目定義書または状態管理・データフロー設計書 |

---

## 14. エラー表示方針

## 14.1 基本方針

エラーは、画面上で利用者が理解できる形で表示する。

初期実装では、画面ごとに簡潔なエラーメッセージを表示する。

## 14.2 エラー分類

| エラー              | 表示方針                    |
| ---------------- | ----------------------- |
| 401 Unauthorized | ログイン画面へ遷移する、または再ログインを促す |
| 403 Forbidden    | 権限がない旨を表示する             |
| 400 Bad Request  | 入力内容に問題がある旨を表示する        |
| 404 Not Found    | 必要に応じて対象データなしとして扱う      |
| 500 Server Error | 時間をおいて再試行する旨を表示する       |
| Network Error    | 通信に失敗した旨を表示する           |

## 14.3 API clientで扱うエラー

API clientでは、HTTPステータスに応じて共通エラー型へ変換する。

```ts id="api-error-type"
type ApiError = {
  status: number;
  message: string;
  code?: string;
};
```

画面側では、`ApiError` を受け取り、画面文脈に応じて表示する。

---

## 15. ローディング表示方針

## 15.1 基本方針

API通信中は、ユーザーが処理中であることを理解できるようにローディング状態を表示する。

## 15.2 ローディングの種類

| 処理      | 表示方針              |
| ------- | ----------------- |
| 認証状態確認中 | 全体ローディング          |
| 日次記録取得中 | 日次記録画面内でローディング    |
| 保存中     | 保存ボタンをdisabledにする |
| 履歴月次取得中 | カレンダー周辺でローディング    |
| 日次詳細取得中 | 詳細欄でローディング        |
| 削除中     | 削除ボタンをdisabledにする |

## 15.3 二重送信防止

保存・削除などの更新系処理中は、対象ボタンをdisabledにする。

```text id="double-submit-policy"
保存中:
保存ボタン disabled

削除中:
削除ボタン disabled
```

---

## 16. コンポーネント設計方針

## 16.1 基本方針

コンポーネントは、画面単位と部品単位に分ける。

| 種別               | 役割                    |
| ---------------- | --------------------- |
| page component   | 画面全体の構成、データ取得、状態管理    |
| form component   | 入力項目の表示、入力イベント処理      |
| UI component     | ボタン、入力欄、エラー表示などの再利用部品 |
| layout component | ヘッダー、ナビゲーション、全体レイアウト  |

## 16.2 コンポーネント候補

| コンポーネント           | 役割                      |
| ----------------- | ----------------------- |
| `AppLayout`       | 認証後画面の共通レイアウト           |
| `Header`          | 画面上部のタイトル、ナビゲーション、ログアウト |
| `LoginPage`       | ログイン開始画面                |
| `DailyPage`       | 日次記録画面                  |
| `MealForm`        | 食事記録フォーム                |
| `ConditionForm`   | 体調記録フォーム                |
| `WorkoutForm`     | 筋トレ記録フォーム               |
| `HistoryPage`     | 履歴画面                    |
| `HistoryCalendar` | 月次カレンダー                 |
| `DailyDetail`     | 日次詳細表示                  |
| `LoadingMessage`  | ローディング表示                |
| `ErrorMessage`    | エラー表示                   |

---

## 17. ディレクトリ構成

## 17.1 基本方針

初期実装では、以下の構成を基本とする。

```text id="frontend-directory"
src/
  api/
    apiClient.ts
    meals.ts
    conditions.ts
    workouts.ts
    history.ts

  components/
    layout/
    common/
    daily/
    history/

  contexts/
    AuthContext.tsx

  hooks/
    useAuth.ts
    useDailyRecords.ts
    useHistoryRecords.ts
    useTodayRecordDate.ts

  pages/
    LoginPage.tsx
    DailyPage.tsx
    HistoryPage.tsx

  types/
    api.ts
    auth.ts
    meal.ts
    condition.ts
    workout.ts
    history.ts

  utils/
    date.ts
    form.ts

  App.tsx
  main.tsx
```

## 17.2 採用理由

この構成を採用する理由は以下。

* 小規模アプリとして理解しやすい
* pages / components / hooks / contexts / utils / types の責務が分かりやすい
* 現在のアプリ規模に対して過度に複雑ではない
* 将来的にfeature単位構成へ移行しやすい

## 17.3 将来課題

機能が増えた場合は、feature単位の構成を検討する。

例：

```text id="feature-directory-future"
src/
  features/
    meals/
    conditions/
    workouts/
    history/
    auth/
```

---

## 18. 環境変数方針

## 18.1 基本方針

フロントエンドでは、環境ごとに変わる値を環境変数で管理する。

主な環境変数候補は以下。

| 環境変数                               | 内容                       |
| ---------------------------------- | ------------------------ |
| `VITE_API_BASE_URL`                | バックエンドAPIのBase URL       |
| `VITE_COGNITO_USER_POOL_ID`        | Cognito User Pool ID     |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | Cognito App Client ID    |
| `VITE_COGNITO_DOMAIN`              | Cognito Managed Login Domain |
| `VITE_COGNITO_REDIRECT_SIGN_IN`    | ログイン後callback URL        |
| `VITE_COGNITO_REDIRECT_SIGN_OUT`   | ログアウト後URL                |
| `VITE_COGNITO_REGION`              | Cognitoのリージョン            |

## 18.2 注意事項

SPAでは、Viteの環境変数はビルド後のJavaScriptから参照可能である。

そのため、以下の情報はフロントエンド環境変数に含めない。

* client secret
* 秘密鍵
* DB接続情報
* AWS secret access key
* 管理者用credential

---

## 19. セキュリティ方針

フロントエンドでは、以下を基本方針とする。

* client secretをブラウザに持たせない
* APIリクエストではAccess TokenをAuthorizationヘッダーに付与する
* ID TokenをAPI認可に使わない
* userIdをクライアントから送信しない
* 認可判断をフロントエンドだけで完結させない
* ログアウト後は取得済みデータを破棄する
* エラー表示にtokenや内部情報を出さない
* XSS対策として不要なHTML挿入を避ける
* 将来的にCSP導入を検討する

---

## 20. 初期実装スコープ

初期実装で行うことは以下。

* React Routerによる画面ルーティング
* PrivateRouteによる認証必須画面の制御
* Amplify Authの設定
* Cognito Managed Loginへのログイン導線
* ログアウト処理
* AuthContextによる認証状態管理
* API clientの作成
* Access TokenのAuthorizationヘッダー付与
* 食事記録API呼び出し
* 体調記録API呼び出し
* 筋トレ記録API呼び出し
* 履歴API呼び出し
* useStateによるフォーム状態管理
* API通信中のローディング表示
* APIエラー時の簡易エラー表示
* JST午前5時境界の記録日算出

---

## 21. 初期実装では扱わないこと

初期実装では以下を扱わない。

* TanStack Query
* React Hook Form
* Zod
* Redux / Zustandなどの外部状態管理
* feature単位ディレクトリ構成
* UIコンポーネントライブラリ導入
* 多言語対応
* テーマ切り替え
* 複雑なアクセシビリティ対応
* オフライン対応
* PWA対応
* WebView対応
* token保存方式の高度化
* BFF構成

---

## 22. 将来課題

## 22.1 TanStack Query導入

API取得・保存後再取得・キャッシュ管理が複雑になった場合は、TanStack Queryを導入する。

導入候補となる処理は以下。

* 月次履歴取得
* 日次詳細取得
* 食事記録取得
* 体調記録取得
* 筋トレ記録取得
* 保存後の再取得
* 削除後の再取得
* 401時の共通処理

## 22.2 React Hook Form / Zod導入

フォーム項目やバリデーションが複雑になった場合は、React Hook Form / Zodを導入する。

導入候補となる処理は以下。

* 食事記録フォーム
* 体調記録フォーム
* 筋トレ記録フォーム
* 入力値の型変換
* バリデーション
* エラーメッセージ表示

## 22.3 feature単位ディレクトリ構成

機能が増えた場合は、feature単位のディレクトリ構成へ移行する。

## 22.4 token保存方式の見直し

初期実装ではAmplify Auth標準に寄せるが、セキュリティ強化が必要になった場合は以下を検討する。

* sessionStorage
* memory storage
* refresh tokenのHttpOnly Cookie化
* BFF構成
* CSP強化

## 22.5 UI改善

将来的に以下を検討する。

* デザイン統一
* UIコンポーネントライブラリ導入
* アクセシビリティ改善
* レスポンシブ対応強化
* 成功メッセージ・トースト表示

---

## 23. 後続設計書への引き継ぎ

| 後続資料           | 引き継ぐ内容                                                   |
| -------------- | -------------------------------------------------------- |
| 状態管理・データフロー設計書 | 認証状態、API取得状態、保存後再取得、削除後再取得、ローディング、エラー                    |
| データ項目定義書       | フォーム項目、API request / response、Form state、型変換             |
| バリデーション・エラー設計書 | 入力制約、エラー文言、APIエラー表示                                      |
| テスト観点表         | 画面表示、フォーム入力、API通信、認証状態、エラー表示                             |
| AWS構成メモ        | Cognito Managed Login、環境変数、callback URL、logout URL           |
| ADR / 設計判断メモ   | TanStack Queryを初期導入しない判断、React Hook Form / Zodを将来課題にする判断 |
