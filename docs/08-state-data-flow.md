# 健康管理マスター 状態管理・データフロー設計書 v0.1

## 1. ドキュメントの目的

本ドキュメントは、健康管理マスターにおける状態管理およびデータフローの設計方針を整理するための資料である。

本ドキュメントでは、以下を定義する。

* フロントエンドで管理する状態
* 認証状態の流れ
* 日次記録画面のデータフロー
* 履歴画面のデータフロー
* フォーム状態とAPI requestの変換
* API取得・保存・削除後の状態更新
* ローディング状態
* エラー状態
* ログアウト時の状態破棄
* 初期実装スコープ
* 将来課題

詳細な画面仕様は画面設計書で扱う。
API仕様はAPI設計書で扱う。
データ項目はデータ項目定義書で扱う。
入力制約やエラー文言はバリデーション・エラー設計書で扱う。

> **v2に関する注記**
> 履歴画面のデータフローは v2 で変更している。週間グラフ用に週次取得フック（`useWeeklyRecords`）を追加し、`GET /api/history/weekly` を1回呼んで日曜〜土曜の7日分をまとめて取得する。グラフの項目切り替えおよび日別詳細表示は、この単一レスポンスから参照する（項目切替ごとの再取得は行わない）。詳細は「UI設計書 v2（14）」およびAPI設計書（API-404）を参照（→14参照）。保存・削除後の再取得や状態破棄などの基本方針は本書のまま有効。

---

## 2. 状態管理の基本方針

初期実装では、React標準の状態管理を利用する。

使用する主な仕組みは以下。

* `useState`
* `useEffect`
* `Context`

初期実装では、以下の外部状態管理ライブラリは導入しない。

* TanStack Query
* Redux
* Zustand
* Jotai
* Recoil

理由：

* 画面数が少ない
* API数が限定的
* 状態の依存関係が複雑ではない
* まず完成させることを優先する
* React標準の状態管理を理解しやすい

将来的にAPI取得・キャッシュ・再取得・エラー管理が複雑になった場合は、TanStack Queryの導入を検討する。

---

## 3. 状態の分類

本アプリケーションで扱う状態は、以下に分類する。

| 状態分類    | 内容                        | 管理場所                |
| ------- | ------------------------- | ------------------- |
| 認証状態    | ログイン済みか、認証確認中か、認証済みユーザー情報 | AuthContext         |
| 画面状態    | 選択中の日付、表示中の年月、選択日付        | 各Page               |
| フォーム状態  | 入力中の食事・体調・筋トレフォーム         | 各PageまたはForm        |
| API取得状態 | 取得中、取得結果、取得エラー            | 各Pageまたはcustom hook |
| API更新状態 | 保存中、削除中、保存結果、削除結果         | 各Pageまたはcustom hook |
| エラー状態   | 入力エラー、APIエラー、認証エラー        | 各PageまたはForm        |
| 成功メッセージ | 保存成功、削除成功、ログアウト成功         | 各Page               |
| 一時UI状態  | 確認ダイアログ、ボタンdisabledなど     | 各Component          |

---

## 4. 認証状態管理

## 4.1 基本方針

認証状態は `AuthContext` で管理する。

`AuthContext` は、アプリ全体から認証状態を参照できるようにする。

## 4.2 AuthContextで管理する状態

```ts id="auth-state-type"
type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: AuthUser | null;
  error: string | null;
};
```

| 状態              | 内容                    |
| --------------- | --------------------- |
| isAuthenticated | 認証済みかどうか              |
| isLoading       | 認証状態確認中かどうか           |
| currentUser     | 認証済みユーザー情報            |
| error           | 認証状態確認・ログアウト等で発生したエラー |

## 4.3 認証状態の初期確認

アプリ起動時に、Amplify Authから現在の認証状態を確認する。

```text id="auth-initial-flow"
アプリ起動
↓
AuthProvider mount
↓
Amplify Authで認証状態確認
↓
認証済みなら currentUser 設定
↓
未認証なら currentUser = null
↓
isLoading = false
```

## 4.4 認証状態確認中の扱い

認証状態確認中は、認証必須画面の表示判定を行わず、ローディングを表示する。

理由：

* 認証確認前にログイン画面へ戻してしまう誤判定を防ぐ
* Managed Loginから戻った直後の認証状態復元を待つため
* リロード時のセッション復元を待つため

## 4.5 ログイン時の流れ

ログインはCognito Managed Loginへのリダイレクトで行う。

```text id="login-data-flow"
ログインボタン押下
↓
AuthContext.login()
↓
Amplify Auth signInWithRedirect()
↓
Cognito Managed Loginへ遷移
↓
Cognitoで認証
↓
React SPAへcallback
↓
AuthContextが認証状態を再確認
↓
認証済みなら /daily へ遷移
```

## 4.6 ログアウト時の流れ

ログアウト時は、認証状態と画面上の取得済みデータを破棄する。

```text id="logout-data-flow"
ログアウトボタン押下
↓
AuthContext.logout()
↓
Amplify Auth signOut()
↓
AuthContextの状態を初期化
↓
画面側の取得済みデータ・フォーム状態を破棄
↓
ログイン画面へ遷移
```

---

## 5. ルーティングと状態の関係

## 5.1 PrivateRoute

認証必須画面は `PrivateRoute` 配下に配置する。

`PrivateRoute` は `AuthContext` の状態を参照して表示を切り替える。

```text id="private-route-state-flow"
isLoading = true
↓
ローディング表示

isLoading = false かつ isAuthenticated = true
↓
認証必須画面を表示

isLoading = false かつ isAuthenticated = false
↓
ログイン画面へ遷移
```

## 5.2 認証済みユーザーがログイン画面へアクセスした場合

認証済みユーザーが `/` にアクセスした場合は、日次記録画面へ遷移する。

```text id="authenticated-login-page-flow"
/ にアクセス
↓
認証状態確認
↓
認証済み
↓
/daily へ遷移
```

---

## 6. API通信時の共通データフロー

## 6.1 基本方針

API通信は、画面コンポーネントから直接 `fetch` せず、共通API clientを経由する。

```text id="api-data-flow"
Page / Form
↓
custom hook
↓
resource API function
↓
apiClient
↓
Backend API
```

## 6.2 認証必須APIの流れ

認証必須APIでは、apiClientがAmplify AuthからAccess Tokenを取得し、Authorizationヘッダーへ付与する。

```text id="auth-api-flow"
API呼び出し
↓
apiClient
↓
fetchAuthSession()
↓
access token取得
↓
Authorizationヘッダー付与
↓
Backend APIへ送信
↓
JWT検証
↓
currentUser解決
↓
レスポンス返却
```

## 6.3 APIエラー時の流れ

APIエラーはapiClientで共通エラー型へ変換し、画面側で表示する。

```text id="api-error-flow"
Backend APIエラー
↓
apiClientがHTTPステータスを確認
↓
ApiErrorへ変換
↓
custom hookまたはPageへthrow
↓
画面側でエラーstate更新
↓
エラーメッセージ表示
```

---

## 7. 日次記録画面の状態管理

## 7.1 日次記録画面で管理する状態

日次記録画面では、以下の状態を管理する。

| 状態                | 内容           |
| ----------------- | ------------ |
| selectedDate      | 現在選択中の記録日    |
| mealForm          | 食事記録フォーム状態   |
| conditionForm     | 体調記録フォーム状態   |
| workoutForm       | 筋トレ記録フォーム状態  |
| isLoading         | 日次記録取得中      |
| isSavingMeal      | 食事記録保存中      |
| isSavingCondition | 体調記録保存中      |
| isSavingWorkout   | 筋トレ記録保存中     |
| pageError         | 画面全体エラー      |
| mealErrors        | 食事フォーム入力エラー  |
| conditionErrors   | 体調フォーム入力エラー  |
| workoutErrors     | 筋トレフォーム入力エラー |
| successMessage    | 保存成功メッセージ    |

## 7.2 初期表示時の流れ

日次記録画面の初期表示時は、JST午前5時境界を考慮した記録日を算出し、その日付の記録を取得する。

```text id="daily-initial-flow"
DailyPage mount
↓
今日の記録日を算出
↓
selectedDateへ設定
↓
食事記録取得
↓
体調記録取得
↓
筋トレ記録取得
↓
取得結果を各フォームstateへ反映
```

## 7.3 日付変更時の流れ

日付が変更された場合は、変更後の日付で各記録を再取得する。

```text id="daily-date-change-flow"
selectedDate変更
↓
食事記録取得
↓
体調記録取得
↓
筋トレ記録取得
↓
フォームstateを再初期化
↓
エラー・成功メッセージをクリア
```

## 7.4 記録取得時の扱い

各記録取得APIの結果に応じて、フォーム状態を初期化する。

```text id="daily-fetch-result-flow"
API結果あり
↓
API responseをFormStateへ変換
↓
フォームに反映

API結果 null
↓
空のFormStateを設定
```

## 7.5 日次記録取得の並列化

食事・体調・筋トレ記録は、同じ日付に対して独立して取得できる。

初期実装では、必要に応じて並列取得を行う。

```text id="daily-fetch-parallel"
selectedDate
↓
Promise.all([
  getMealByDate,
  getConditionByDate,
  getWorkoutByDate
])
↓
各フォームへ反映
```

ただし、一部のAPI取得に失敗した場合の表示は複雑になるため、初期実装では画面全体エラーとして扱ってもよい。

---

## 8. 食事記録保存フロー

## 8.1 保存前の流れ

食事記録保存時は、FormStateをAPI requestへ変換し、保存前バリデーションを行う。

```text id="meal-save-flow"
食事保存ボタン押下
↓
mealFormをSaveMealInputへ変換
↓
バリデーション
↓
問題なし
↓
saveMeal API呼び出し
↓
保存結果をmealFormへ反映
↓
成功メッセージ表示
```

## 8.2 保存成功時の状態更新

保存成功時は、API responseをもとにフォーム状態を更新する。

理由：

* バックエンドで正規化された値を反映するため
* `null` や数値変換後の状態と画面を揃えるため
* 将来的にcreatedAt / updatedAtを利用する余地を残すため

## 8.3 保存失敗時の状態更新

保存失敗時は、入力中のフォーム値を維持する。

```text id="meal-save-error-flow"
保存失敗
↓
mealFormは維持
↓
mealErrorsまたはpageErrorを設定
↓
成功メッセージはクリア
```

理由：

* 入力内容を失わないため
* ユーザーが修正して再保存できるようにするため

---

## 9. 体調記録保存フロー

## 9.1 保存前の流れ

```text id="condition-save-flow"
体調保存ボタン押下
↓
conditionFormをSaveConditionInputへ変換
↓
バリデーション
↓
問題なし
↓
saveCondition API呼び出し
↓
保存結果をconditionFormへ反映
↓
成功メッセージ表示
```

## 9.2 保存成功時の状態更新

保存成功時は、API responseをFormStateへ変換して反映する。

## 9.3 保存失敗時の状態更新

保存失敗時は、入力中のフォーム値を維持し、エラーを表示する。

---

## 10. 筋トレ記録保存フロー

## 10.1 保存前の流れ

```text id="workout-save-flow"
筋トレ保存ボタン押下
↓
workoutFormをSaveWorkoutInputへ変換
↓
バリデーション
↓
問題なし
↓
saveWorkout API呼び出し
↓
保存結果をworkoutFormへ反映
↓
成功メッセージ表示
```

## 10.2 保存成功時の状態更新

保存成功時は、API responseをFormStateへ反映する。

## 10.3 保存失敗時の状態更新

保存失敗時は、入力中のフォーム値を維持し、エラーを表示する。

---

## 11. 履歴画面の状態管理

## 11.1 履歴画面で管理する状態

履歴画面では、以下の状態を管理する。

| 状態               | 内容          |
| ---------------- | ----------- |
| displayYear      | 表示中の年       |
| displayMonth     | 表示中の月       |
| markedDates      | 記録が存在する日付一覧 |
| selectedDate     | 選択中の日付      |
| dailyHistory     | 選択日の詳細      |
| isLoadingMonthly | 月次履歴取得中     |
| isLoadingDaily   | 日次詳細取得中     |
| isDeleting       | 日次記録削除中     |
| pageError        | 画面全体エラー     |
| successMessage   | 削除成功メッセージ   |

## 11.2 初期表示時の流れ

履歴画面の初期表示時は、現在の年月を表示対象とし、月次履歴を取得する。

```text id="history-initial-flow"
HistoryPage mount
↓
現在年月を算出
↓
displayYear / displayMonthへ設定
↓
月次履歴取得
↓
markedDatesへ反映
```

## 11.3 月変更時の流れ

表示月を変更した場合は、変更後の年月で月次履歴を再取得する。

```text id="history-month-change-flow"
前月・次月ボタン押下
↓
displayYear / displayMonth更新
↓
selectedDateを必要に応じてクリア
↓
dailyHistoryをクリア
↓
月次履歴取得
↓
markedDatesへ反映
```

## 11.4 日付選択時の流れ

カレンダー上の日付を選択した場合、その日付の日次詳細を取得する。

```text id="history-date-select-flow"
日付選択
↓
selectedDate更新
↓
日次詳細取得
↓
dailyHistoryへ反映
```

記録が存在しない日付を選択した場合の扱いは、画面設計書に従う。

初期実装では、記録が存在しない日付も選択可能とし、詳細欄に「記録なし」と表示してもよい。

---

## 12. 日次一括削除フロー

## 12.1 削除前の流れ

日次一括削除では、選択中の日付の食事・体調・筋トレ記録をまとめて削除する。

```text id="daily-delete-flow"
削除ボタン押下
↓
確認ダイアログ表示
↓
ユーザーが削除を確定
↓
deleteDailyRecords API呼び出し
↓
削除成功
↓
月次履歴を再取得
↓
日次詳細をクリア
↓
成功メッセージ表示
```

## 12.2 削除成功時の状態更新

削除成功時は、以下を行う。

* `dailyHistory` をクリアする
* `selectedDate` は維持してもよい
* `markedDates` を再取得する
* `successMessage` を表示する
* `pageError` をクリアする

```text id="delete-success-state"
dailyHistory = null
markedDates = 再取得結果
successMessage = 日次記録を削除しました
```

## 12.3 削除失敗時の状態更新

削除失敗時は、既存の表示を維持し、エラーを表示する。

```text id="delete-error-state"
dailyHistoryは維持
markedDatesは維持
pageErrorを設定
successMessageをクリア
```

---

## 13. FormStateとAPI requestの変換

## 13.1 基本方針

フォーム入力中の状態とAPIへ送る値は分離する。

```text id="form-to-api-policy"
FormState:
画面入力用。主にstring。

API request:
保存用。number / null / string / null。
```

理由：

* HTML inputの値はstringであるため
* 空文字を扱いやすいため
* 小数入力途中の状態を壊さないため
* APIへは正規化された値を送るため

## 13.2 数値変換

保存時に、数値項目をstringからnumberまたはnullへ変換する。

| FormState値 | API request値 |
| ---------- | ------------ |
| `""`       | `null`       |
| `"   "`    | `null`       |
| `"72.5"`   | `72.5`       |
| `"0"`      | `0`          |
| `"abc"`    | バリデーションエラー   |

## 13.3 memo変換

メモ項目は、保存時にtrimして扱う。

| FormState値 | API request値 |
| ---------- | ------------ |
| `""`       | `null`       |
| `"   "`    | `null`       |
| `" 食事メモ "` | `"食事メモ"`     |

## 13.4 API responseからFormStateへの変換

API responseをフォームに反映する際は、nullを空文字へ変換する。

| API response値 | FormState値 |
| ------------- | ---------- |
| `null`        | `""`       |
| `72.5`        | `"72.5"`   |
| `"メモ"`        | `"メモ"`     |

---

## 14. ローディング状態管理

## 14.1 基本方針

API通信中は、対象操作に応じたローディング状態を管理する。

## 14.2 ローディング状態一覧

| 状態                    | 用途       |
| --------------------- | -------- |
| authLoading           | 認証状態確認中  |
| isLoadingDaily        | 日次記録取得中  |
| isSavingMeal          | 食事記録保存中  |
| isSavingCondition     | 体調記録保存中  |
| isSavingWorkout       | 筋トレ記録保存中 |
| isLoadingMonthly      | 月次履歴取得中  |
| isLoadingHistoryDaily | 日次詳細取得中  |
| isDeleting            | 日次記録削除中  |

## 14.3 ボタンdisabled制御

更新系処理中は、二重送信を防ぐためボタンをdisabledにする。

| 処理     | disabled対象 |
| ------ | ---------- |
| 食事保存中  | 食事保存ボタン    |
| 体調保存中  | 体調保存ボタン    |
| 筋トレ保存中 | 筋トレ保存ボタン   |
| 削除中    | 削除ボタン      |
| ログアウト中 | ログアウトボタン   |

---

## 15. エラー状態管理

## 15.1 エラー分類

フロントエンドでは、エラーを以下に分けて管理する。

| エラー分類       | 内容                |
| ----------- | ----------------- |
| fieldErrors | 入力項目ごとのバリデーションエラー |
| formError   | フォーム全体のエラー        |
| pageError   | 画面全体のエラー          |
| authError   | 認証関連エラー           |

## 15.2 fieldErrors

入力項目に紐づくエラーは、対象フォームの `fieldErrors` に保持する。

```ts id="field-errors-type"
type FieldErrors = {
  [field: string]: string;
};
```

## 15.3 pageError

API取得失敗、通信失敗、サーバーエラーなど、画面全体に関わるエラーは `pageError` として管理する。

```ts id="page-error-type"
type PageError = string | null;
```

## 15.4 エラークリア方針

エラーは以下のタイミングでクリアする。

| タイミング  | クリア対象               |
| ------ | ------------------- |
| 日付変更時  | フォームエラー、成功メッセージ     |
| 保存成功時  | 対象フォームエラー、pageError |
| 削除成功時  | pageError           |
| 再取得成功時 | pageError           |
| ログアウト時 | 全エラー                |

---

## 16. 401 / 403 発生時のデータフロー

## 16.1 401 Unauthorized

401が発生した場合は、apiClientがtokenを強制更新して同一リクエストを1回だけ再試行する。
再試行してもなお401なら、回復不能とみなしログアウトする（認証・認可設計書 17.1）。

```text id="unauthorized-flow"
API response 401
↓
apiClientが fetchAuthSession({ forceRefresh: true }) でtoken更新
↓
更新後のAccess Tokenで同一リクエストを1回だけ再試行
↓
再試行も401
↓
AuthContextを初期化（signOut）
↓
ログイン画面へ遷移
```

方針：

* 再試行は1回のみとする（無限リトライを避ける）
* 再試行対象は401のみとし、403・5xxは再試行しない
* 5xx（Cognito UserInfo / JWKS取得などの外部障害。認証・認可設計書 17.4 / 17.6）は
  認証切れとして扱わず、ログアウトしない

## 16.2 403 Forbidden

403が発生した場合は、ログイン画面へ戻すのではなく、権限エラーとして表示する。

```text id="forbidden-flow"
API response 403
↓
pageError = この操作を行う権限がありません。
```

---

## 17. 成功メッセージ管理

## 17.1 基本方針

保存・削除成功時には、簡潔な成功メッセージを表示する。

## 17.2 成功メッセージ一覧

| 操作    | メッセージ         |
| ----- | ------------- |
| 食事保存  | 食事記録を保存しました。  |
| 体調保存  | 体調記録を保存しました。  |
| 筋トレ保存 | 筋トレ記録を保存しました。 |
| 日次削除  | 日次記録を削除しました。  |

## 17.3 成功メッセージのクリア

成功メッセージは以下のタイミングでクリアする。

* 日付変更時
* 別の保存操作開始時
* エラー発生時
* 画面遷移時

初期実装では、自動消去は必須としない。
将来的にトースト通知を導入する場合は、自動消去を検討する。

---

## 18. キャッシュ方針

## 18.1 初期実装方針

初期実装では、明示的なキャッシュ管理は行わない。

API取得結果は画面stateとして保持する。

```text id="cache-initial-policy"
API取得結果
↓
画面stateに保持
↓
画面離脱時に破棄
```

理由：

* 画面数が少ない
* API負荷が小さい
* 実装を単純に保てる
* TanStack Queryを初期導入しない方針であるため

## 18.2 再取得方針

保存・削除後に必要なデータは再取得する。

| 操作    | 再取得対象                       |
| ----- | --------------------------- |
| 食事保存  | 必須ではない。API responseをフォームへ反映 |
| 体調保存  | 必須ではない。API responseをフォームへ反映 |
| 筋トレ保存 | 必須ではない。API responseをフォームへ反映 |
| 日次削除  | 月次履歴を再取得                    |
| 月変更   | 月次履歴を再取得                    |
| 日付選択  | 日次詳細を取得                     |

---

## 19. 状態破棄方針

## 19.1 画面遷移時

画面遷移時、遷移元画面のローカルstateは破棄される。

例：

```text id="page-unmount-state"
DailyPageからHistoryPageへ遷移
↓
DailyPageのフォームstateは破棄
```

初期実装では、入力途中の内容を画面遷移後に保持しない。

## 19.2 ログアウト時

ログアウト時は、認証状態と画面上のデータを破棄する。

破棄対象：

* AuthContextの認証状態
* currentUser
* フォーム入力値
* API取得結果
* エラー状態
* 成功メッセージ
* ローディング状態

## 19.3 ブラウザリロード時

ブラウザリロード時は、Reactのローカルstateは破棄される。

認証状態はAmplify Authが保持するセッションから復元する。

画面固有のフォーム入力中データは復元しない。

---

## 20. custom hook設計

## 20.1 useAuth

`useAuth` は、AuthContextを利用するためのhookである。

責務：

* 認証状態を返す
* login関数を返す
* logout関数を返す
* 認証済みユーザー情報を返す

## 20.2 useDailyRecords

`useDailyRecords` は、日次記録画面の取得・保存状態を管理する。

責務：

* selectedDateに応じて各記録を取得する
* 食事記録を保存する
* 体調記録を保存する
* 筋トレ記録を保存する
* ローディング状態を管理する
* エラー状態を管理する
* 成功メッセージを管理する

## 20.3 useHistoryRecords

`useHistoryRecords` は、履歴画面の月次・日次データを管理する。

責務：

* 表示年月を管理する
* 月次履歴を取得する
* 選択日の日次詳細を取得する
* 日次記録を削除する
* 削除後に月次履歴を再取得する
* ローディング状態を管理する
* エラー状態を管理する

## 20.4 useTodayRecordDate

`useTodayRecordDate` は、JST午前5時境界を考慮した記録日を返す。

責務：

* 現在日時を取得する
* JST基準で判定する
* 5:00未満なら前日を返す
* 5:00以降なら当日を返す
* `YYYY-MM-DD` 形式で返す

---

## 21. 初期実装スコープ

初期実装で扱う状態管理・データフローは以下とする。

* AuthContextによる認証状態管理
* PrivateRouteによる認証必須画面制御
* Amplify Authによる認証状態確認
* apiClientによるAccess Token付与
* 日次記録画面の取得・保存状態管理
* 履歴画面の月次・日次取得状態管理
* 日次一括削除後の再取得
* FormStateからAPI requestへの変換
* API responseからFormStateへの変換
* ローディング状態
* エラー状態
* 成功メッセージ
* ログアウト時の状態破棄

---

## 22. 初期実装では扱わないこと

初期実装では以下を扱わない。

* TanStack Query
* Redux / Zustandなどの外部状態管理
* APIレスポンスの永続キャッシュ
* 入力途中データのlocalStorage保存
* オフライン対応
* 自動保存
* 401時の自動refresh retry制御
* 複雑な楽観的更新
* WebView / React Nativeを前提にした状態管理
* 複数タブ間の状態同期

---

## 23. 将来課題

## 23.1 TanStack Query導入

API取得・再取得・キャッシュ管理が複雑になった場合は、TanStack Queryを導入する。

導入候補：

* 月次履歴取得
* 日次詳細取得
* 食事記録取得
* 体調記録取得
* 筋トレ記録取得
* 保存後の再取得
* 削除後の再取得
* 401時の共通処理

## 23.2 フォーム状態管理の高度化

フォーム項目やバリデーションが複雑になった場合は、React Hook Form / Zodの導入を検討する。

## 23.3 キャッシュ戦略

将来的に以下を検討する。

* 月次履歴のキャッシュ
* 日次詳細のキャッシュ
* 保存後の自動invalidate
* 削除後の自動invalidate
* stale timeの設定
* retry制御

## 23.4 入力途中データの保持

将来的に、画面遷移やリロード時に入力途中データを保持したい場合は、以下を検討する。

* localStorageへの一時保存
* sessionStorageへの一時保存
* debounce保存
* 下書き機能

初期実装では扱わない。

---

## 24. 後続設計書への引き継ぎ

| 後続資料           | 引き継ぐ内容                                      |
| -------------- | ------------------------------------------- |
| テスト観点表         | 認証状態、API取得、保存、削除、エラー、ローディング、状態破棄            |
| ADR / 設計判断メモ   | TanStack Queryを初期導入しない判断、React標準stateで始める判断 |
| フロントエンド設計書     | custom hook、apiClient、AuthContext、FormState |
| バリデーション・エラー設計書 | エラーstate、APIエラー後の表示、保存前バリデーション              |
| データ項目定義書       | FormStateとAPI request / responseの変換         |
