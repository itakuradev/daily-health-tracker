# 健康管理マスター データ項目定義書 v0.1

## 1. ドキュメントの目的

本ドキュメントは、健康管理マスターで扱うデータ項目を定義するための資料である。

本ドキュメントでは、以下を整理する。

* アプリケーションで扱う主要データ
* 各データ項目の意味
* 型
* 必須/任意
* 単位
* null / 空文字の扱い
* フロントエンド・API・DB間での扱い
* 画面表示・入力時の扱い

詳細な入力制約、エラーメッセージ、数値範囲の厳密なバリデーションは、バリデーション・エラー設計書で扱う。

---

## 2. データ項目定義の基本方針

## 2.1 基本方針

健康管理マスターでは、日ごとの食事・体調・筋トレ記録を管理する。

記録は、認証済みユーザーごとに管理する。

基本方針は以下とする。

* ユーザーごとに記録を分離する
* 食事記録は1日1件とする
* 体調記録は1日1件とする
* 筋トレ記録は1日1件とする
* 記録日は `YYYY-MM-DD` 形式で扱う
* DB上では `userId + recordDate` を一意にする
* 入力項目は部分入力を許可する
* 完全に空の記録保存は許可しない
* 未入力値は原則として `null` として扱う
* `0` は未入力ではなく、明示的な数値として扱う
* `userId` はクライアントから送信させない

---

## 3. データ分類

本アプリケーションで扱う主なデータは以下である。

| データ分類          | 内容                  |
| -------------- | ------------------- |
| User           | アプリ利用者              |
| Meal           | 食事記録                |
| Condition      | 体調記録                |
| Workout        | 筋トレ記録               |
| MonthlyHistory | 月次履歴表示用データ          |
| DailyHistory   | 日次詳細表示用データ          |
| AuthUser       | フロントエンド上の認証済みユーザー情報 |
| FormState      | 画面入力中のフォーム状態        |

---

## 4. 共通項目

## 4.1 共通管理項目

各DBレコードでは、以下の管理項目を扱う。

| 項目名  | 物理名       | 型        | 必須 | 内容        | 画面表示        |
| ---- | --------- | -------- | -- | --------- | ----------- |
| ID   | id        | number   | 必須 | DB内部の一意ID | 原則表示しない     |
| 作成日時 | createdAt | DateTime | 必須 | レコード作成日時  | 初期画面では表示しない |
| 更新日時 | updatedAt | DateTime | 必須 | レコード更新日時  | 初期画面では表示しない |

## 4.2 userIdの扱い

| 項目名    | 物理名    | 型      | 必須 | 内容                 |
| ------ | ------ | ------ | -- | ------------------ |
| ユーザーID | userId | number | 必須 | アプリケーション内部のUser ID |

方針：

* `userId` はDB内部で記録データとUserを紐づけるために利用する
* フロントエンドから `userId` を送信しない
* API request body / query parameterでは `userId` を受け取らない
* バックエンドがCognito Access TokenからUserを特定し、内部的に `userId` を設定する
* API responseでも、画面表示に不要であれば `userId` は返さない

---

## 5. null / 空文字 / undefined の扱い

## 5.1 基本方針

未入力値は、アプリケーション内部では原則として `null` として扱う。

| 値           | 扱い                                |
| ----------- | --------------------------------- |
| `null`      | 未入力・未設定                           |
| `undefined` | 原則としてAPI request / responseでは使わない |
| 空文字 `""`    | フォーム入力中のみ許容。保存時に `null` へ変換する     |
| 空白のみの文字列    | trim後に空であれば `null` として扱う          |
| `0`         | 明示的な数値として扱う。未入力とはみなさない            |

## 5.2 フォーム入力時の扱い

HTML inputの値は基本的に文字列として扱う。

そのため、フロントエンドのFormStateでは、数値項目も一時的に `string` として保持する。

```text id="form-state-policy"
入力中:
stringで保持

保存時:
number または null に変換
```

理由：

* 空文字を扱いやすい
* 小数点入力途中の状態を壊しにくい
* 画面表示とAPI送信値を分離できる

## 5.3 API送信時の扱い

保存APIへ送信する値は、以下の方針で変換する。

| フォーム値    | API送信値 |
| -------- | ------ |
| `""`     | `null` |
| `"   "`  | `null` |
| `"72.5"` | `72.5` |
| `"2300"` | `2300` |
| `"メモ"`   | `"メモ"` |
| `0`相当の入力 | `0`    |

---

## 6. 記録日

## 6.1 recordDate

| 項目名 | 物理名        | API型   | DB型  | 必須 | 形式           | 内容              |
| --- | ---------- | ------ | ---- | -- | ------------ | --------------- |
| 記録日 | recordDate | string | Date | 必須 | `YYYY-MM-DD` | 食事・体調・筋トレ記録の対象日 |

方針：

* APIでは `YYYY-MM-DD` 形式の文字列で扱う
* DBでは日付型として扱う
* 時刻情報は持たない
* JST午前5時境界を考慮した「今日の記録日」の算出はフロントエンドで行う
* バックエンドでは受け取った `recordDate` を記録日として保存する

例：

```text id="record-date-example"
2026-07-08
```

---

## 7. User

## 7.1 Userの概要

Userは、健康管理マスターの利用者を表す。

Cognito認証後、Cognitoの `sub` とアプリケーションDBのUserを紐づける。

## 7.2 User項目

| 項目名         | 物理名        | 型             | 必須 | 一意  | 内容                   |
| ----------- | ---------- | ------------- | -- | --- | -------------------- |
| ID          | id         | number        | 必須 | 一意  | アプリケーション内部のユーザーID    |
| メールアドレス     | email      | string        | 必須 | 一意  | Cognitoから取得するメールアドレス |
| 表示名         | name       | string / null | 任意 | 非一意 | 表示名。取得できない場合はnull    |
| Cognito Sub | cognitoSub | string        | 必須 | 一意  | Cognito上のユーザー識別子     |
| 作成日時        | createdAt  | DateTime      | 必須 | -   | User作成日時             |
| 更新日時        | updatedAt  | DateTime      | 必須 | -   | User更新日時             |

## 7.3 User設計方針

* `cognitoSub` をCognitoとの紐づけキーにする
* `email` は一意とする
* `email` だけを認証上の主キーとして扱わない
* `name` は任意とする
* 記録データはUserの内部IDである `id` に紐づける
* 初回APIアクセス時にUserが存在しない場合は、UserInfoから取得した属性をもとにUserを作成する
* `email` が取得できない場合は、架空の値を保存せずUserを作成しない

Access Tokenには `email` / `name` が含まれないため、初回作成時の属性はCognitoのclaimではなくUserInfoエンドポイントから取得する（認証・認可設計書 7.1 / 10.3）。

## 7.4 schema適用状況

Cognito導入に伴うschema変更は適用済みである（migration `cognito_auth`）。

```prisma id="current-user-schema"
name       String?           // UserInfoで取得できない場合を考慮しnullable
cognitoSub String  @unique   // 認証済みUserに対して必須・一意
```

`name` を必須にせずnullableとした理由：

* Cognitoから常に表示名が取得できるとは限らない
* 初期利用者本人のみであれば、表示名なしでも機能上問題ない
* emailとcognitoSubがあればユーザー識別は可能
* 空文字を保存する案は、値の有無を判別できなくなるため採用しない

`cognitoSub` のunique制約は、初回User作成の冪等性を担保する役割も持つ（認証・認可設計書 10.5）。

なお、この変更に伴い `cognitoSub` を持たない固定seedユーザーは廃止し、migration内で削除している（認証・認可設計書 18.2）。

---

## 8. Meal

## 8.1 Mealの概要

Mealは、日ごとの食事記録を表す。

1ユーザーにつき、同一記録日のMealは1件のみとする。

```text id="meal-unique-policy"
userId + recordDate で一意
```

## 8.2 Meal項目

| 項目名   | 物理名        | API型          | FormState型 | DB型      | 必須 | 単位   | 内容      |
| ----- | ---------- | ------------- | ---------- | -------- | -- | ---- | ------- |
| ID    | id         | number        | -          | Int      | 必須 | -    | 食事記録ID  |
| 記録日   | recordDate | string        | string     | Date     | 必須 | -    | 対象日     |
| カロリー  | calories   | number / null | string     | Int?     | 任意 | kcal | 総摂取カロリー |
| たんぱく質 | protein    | number / null | string     | Float?   | 任意 | g    | たんぱく質量  |
| 脂質    | fat        | number / null | string     | Float?   | 任意 | g    | 脂質量     |
| 炭水化物  | carbs      | number / null | string     | Float?   | 任意 | g    | 炭水化物量   |
| カルシウム | calcium    | number / null | string     | Float?   | 任意 | mg   | カルシウム量  |
| 食事メモ  | memo       | string / null | string     | String?  | 任意 | -    | 食事内容や補足 |
| 作成日時  | createdAt  | string        | -          | DateTime | 必須 | -    | 作成日時    |
| 更新日時  | updatedAt  | string        | -          | DateTime | 必須 | -    | 更新日時    |

## 8.3 Meal入力方針

Mealでは、以下の項目を入力できる。

* カロリー
* たんぱく質
* 脂質
* 炭水化物
* カルシウム
* 食事メモ

すべての食事項目は任意入力とする。

ただし、保存する場合は、少なくとも1項目が入力されている必要がある。

```text id="meal-save-rule"
recordDate:
必須

calories / protein / fat / carbs / calcium / memo:
任意

保存条件:
上記の任意項目のうち、少なくとも1つが入力されていること
```

## 8.4 Mealの空値扱い

| 項目       | 空値の扱い            |
| -------- | ---------------- |
| calories | 未入力は `null`      |
| protein  | 未入力は `null`      |
| fat      | 未入力は `null`      |
| carbs    | 未入力は `null`      |
| calcium  | 未入力は `null`      |
| memo     | 空文字・空白のみは `null` |

---

## 9. Condition

## 9.1 Conditionの概要

Conditionは、日ごとの体調記録を表す。

1ユーザーにつき、同一記録日のConditionは1件のみとする。

```text id="condition-unique-policy"
userId + recordDate で一意
```

## 9.2 Condition項目

| 項目名   | 物理名              | API型          | FormState型 | DB型      | 必須 | 単位 | 内容      |
| ----- | ---------------- | ------------- | ---------- | -------- | -- | -- | ------- |
| ID    | id               | number        | -          | Int      | 必須 | -  | 体調記録ID  |
| 記録日   | recordDate       | string        | string     | Date     | 必須 | -  | 対象日     |
| 体重    | weight           | number / null | string     | Float?   | 任意 | kg | 体重      |
| ウエスト  | waist            | number / null | string     | Float?   | 任意 | cm | ウエスト    |
| 腕周り   | armCircumference | number / null | string     | Float?   | 任意 | cm | 腕周り     |
| 睡眠時間  | sleepHours       | number / null | string     | Float?   | 任意 | 時間 | 睡眠時間    |
| 体調スコア | conditionScore   | number / null | string     | Int?     | 任意 | -  | 体調の主観評価 |
| 作成日時  | createdAt        | string        | -          | DateTime | 必須 | -  | 作成日時    |
| 更新日時  | updatedAt        | string        | -          | DateTime | 必須 | -  | 更新日時    |

## 9.3 Condition入力方針

Conditionでは、以下の項目を入力できる。

* 体重
* ウエスト
* 腕周り
* 睡眠時間
* 体調スコア

すべての体調項目は任意入力とする。

ただし、保存する場合は、少なくとも1項目が入力されている必要がある。

```text id="condition-save-rule"
recordDate:
必須

weight / waist / armCircumference / sleepHours / conditionScore:
任意

保存条件:
上記の任意項目のうち、少なくとも1つが入力されていること
```

## 9.4 体調スコアの定義

体調スコアは、1〜5の整数で扱う。

| 値 | 意味    |
| - | ----- |
| 1 | とても悪い |
| 2 | 悪い    |
| 3 | 普通    |
| 4 | 良い    |
| 5 | とても良い |

方針：

* 未入力の場合は `null`
* 入力する場合は1〜5の整数
* 小数は許可しない
* 意味は画面上でも分かるように表示する

## 9.5 Conditionの空値扱い

| 項目               | 空値の扱い       |
| ---------------- | ----------- |
| weight           | 未入力は `null` |
| waist            | 未入力は `null` |
| armCircumference | 未入力は `null` |
| sleepHours       | 未入力は `null` |
| conditionScore   | 未入力は `null` |

---

## 10. Workout

## 10.1 Workoutの概要

Workoutは、日ごとの筋トレ記録を表す。

1ユーザーにつき、同一記録日のWorkoutは1件のみとする。

```text id="workout-unique-policy"
userId + recordDate で一意
```

## 10.2 Workout項目

| 項目名   | 物理名        | API型          | FormState型 | DB型      | 必須 | 単位 | 内容      |
| ----- | ---------- | ------------- | ---------- | -------- | -- | -- | ------- |
| ID    | id         | number        | -          | Int      | 必須 | -  | 筋トレ記録ID |
| 記録日   | recordDate | string        | string     | Date     | 必須 | -  | 対象日     |
| 筋トレメモ | memo       | string / null | string     | String?  | 任意 | -  | 筋トレ内容   |
| 作成日時  | createdAt  | string        | -          | DateTime | 必須 | -  | 作成日時    |
| 更新日時  | updatedAt  | string        | -          | DateTime | 必須 | -  | 更新日時    |

## 10.3 Workout入力方針

Workoutでは、筋トレ内容を自由テキストで入力する。

当面は、種目・重量・回数・セット数を構造化しない。

```text id="workout-save-rule"
recordDate:
必須

memo:
保存する場合は入力必須
```

方針：

* `memo` が空文字の場合は保存不可
* 空白のみの場合は保存不可
* 未入力状態は `null` として扱う
* 構造化項目は将来課題とする

---

## 11. MonthlyHistory

## 11.1 MonthlyHistoryの概要

MonthlyHistoryは、履歴画面の月次カレンダーで使用する表示用データである。

指定年月において、食事・体調・筋トレのいずれかの記録が存在する日付一覧を返す。

## 11.2 MonthlyHistory項目

| 項目名      | 物理名   | 型        | 必須 | 内容           |
| -------- | ----- | -------- | -- | ------------ |
| 記録あり日付一覧 | dates | string[] | 必須 | 記録が存在する日付の配列 |

API response例：

```json id="monthly-history-response"
[
  "2026-07-01",
  "2026-07-02",
  "2026-07-08"
]
```

方針：

* 日付は `YYYY-MM-DD` 形式
* 食事・体調・筋トレのいずれかが存在する日付を含める
* 同じ日付を重複して返さない
* 昇順で返すことを基本とする

---

## 12. DailyHistory

## 12.1 DailyHistoryの概要

DailyHistoryは、履歴画面で選択した日付の詳細表示に使用するデータである。

指定日の食事・体調・筋トレ記録をまとめて返す。

## 12.2 DailyHistory項目

| 項目名   | 物理名       | 型                | 必須 | 内容                |
| ----- | --------- | ---------------- | -- | ----------------- |
| 日付    | date      | string           | 必須 | 対象日               |
| 食事記録  | meal      | Meal / null      | 必須 | 食事記録。未登録の場合はnull  |
| 体調記録  | condition | Condition / null | 必須 | 体調記録。未登録の場合はnull  |
| 筋トレ記録 | workout   | Workout / null   | 必須 | 筋トレ記録。未登録の場合はnull |

API response例：

```json id="daily-history-response"
{
  "date": "2026-07-08",
  "meal": null,
  "condition": null,
  "workout": null
}
```

方針：

* 各記録が未登録の場合は `null`
* 未登録日はエラーではなく通常ケースとして扱う
* 画面では存在する記録のみ表示する
* すべて `null` の場合は「記録なし」と表示する

## 12.3 WeeklyHistory（v2追加）

WeeklyHistoryは、履歴画面（v2）の週間グラフで使用する表示用データである。詳細は「UI設計書 v2（14）」を参照。

指定日を含む1週間（**日曜〜土曜**）の DailyHistory を7日分まとめて返す。

| 項目名     | 物理名       | 型                 | 必須 | 内容                       |
| ------- | --------- | ----------------- | -- | ------------------------ |
| 週開始日    | weekStart | string            | 必須 | 週の開始日（日曜）`YYYY-MM-DD`    |
| 週終了日    | weekEnd   | string            | 必須 | 週の終了日（土曜）`YYYY-MM-DD`    |
| 日別データ配列 | days      | DailyHistory[]    | 必須 | 常に7件（記録のない日も含む・空欄はnull） |

方針：

* 週範囲（日曜〜土曜）の算出はバックエンド（`GET /api/history/weekly`）が担う
* `days` は必ず7件返し、記録のない日も日付のみのエントリ（meal/condition/workoutがnull）として含める
* グラフの欠損日は線を途切れさせる（0に落とさない）
* 取得元API・週定義の詳細はAPI設計書（API-404）を参照

## 12.4 週間グラフの対象項目（v2追加）

週間グラフでは、以下の10項目を1項目ずつ切り替えて表示する。項目定義（キー・表示名・単位・値の取り出し）はフロントエンドで一元管理する（`features/history/graphMetrics.ts`）。

| キー              | 表示名   | 単位   | 取得元       |
| --------------- | ----- | ---- | --------- |
| calories        | カロリー  | kcal | Meal      |
| protein         | タンパク質 | g    | Meal      |
| fat             | 脂質    | g    | Meal      |
| carbs           | 炭水化物  | g    | Meal      |
| calcium         | カルシウム | mg   | Meal      |
| weight          | 体重    | kg   | Condition |
| waist           | ウエスト  | cm   | Condition |
| armCircumference | 腕周り   | cm   | Condition |
| sleepHours      | 睡眠時間  | h    | Condition |
| conditionScore  | 体調    | （なし） | Condition |

方針：

* 初期選択は `calories`
* 単位はこの項目定義（graphMetrics）に一元化し、グラフ軸・Tooltip・詳細表示から参照する
* 体調スコアはグラフでは数値のみ（1〜5）で扱い、ラベル（良い等）は付けない

---

## 13. AuthUser

## 13.1 AuthUserの概要

AuthUserは、フロントエンド上で扱う認証済みユーザー情報である。

CognitoまたはアプリケーションAPIから取得した情報をもとに、画面表示や認証状態管理に使用する。

## 13.2 AuthUser項目

| 項目名         | 物理名             | 型             | 必須 | 内容               |
| ----------- | --------------- | ------------- | -- | ---------------- |
| Cognito Sub | sub             | string        | 必須 | Cognito上のユーザー識別子 |
| メールアドレス     | email           | string / null | 任意 | ユーザーのメールアドレス     |
| 表示名         | name            | string / null | 任意 | 表示名              |
| 認証済み        | isAuthenticated | boolean       | 必須 | 認証済みかどうか         |

方針：

* 認証状態の判定にはAmplify Authを利用する
* APIアクセス時のユーザー識別はバックエンド側で行う
* フロントエンド上のAuthUserは画面制御用とする
* フロントエンドのAuthUserを認可判断の根拠にしない

---

## 14. FormState

## 14.1 MealFormState

```ts id="meal-form-state"
type MealFormState = {
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  calcium: string;
  memo: string;
};
```

## 14.2 ConditionFormState

```ts id="condition-form-state"
type ConditionFormState = {
  weight: string;
  waist: string;
  armCircumference: string;
  sleepHours: string;
  conditionScore: string;
};
```

## 14.3 WorkoutFormState

```ts id="workout-form-state"
type WorkoutFormState = {
  memo: string;
};
```

## 14.4 FormState設計方針

* 入力中はstringで保持する
* 保存時にAPI request用の型へ変換する
* 空文字は保存時に `null` へ変換する
* 数値項目は保存時にnumberへ変換する
* フォームstateとAPI request型を分離する

---

## 15. API Request型

## 15.1 SaveMealInput

```ts id="save-meal-input"
type SaveMealInput = {
  recordDate: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  calcium: number | null;
  memo: string | null;
};
```

## 15.2 SaveConditionInput

```ts id="save-condition-input"
type SaveConditionInput = {
  recordDate: string;
  weight: number | null;
  waist: number | null;
  armCircumference: number | null;
  sleepHours: number | null;
  conditionScore: number | null;
};
```

## 15.3 SaveWorkoutInput

```ts id="save-workout-input"
type SaveWorkoutInput = {
  recordDate: string;
  memo: string | null;
};
```

## 15.4 API Request設計方針

* `recordDate` は必須
* `userId` は含めない
* 未入力項目は `null` として送信する
* 保存APIでは、既存値を上書きする
* 値をクリアしたい場合は `null` を送信する

---

## 16. API Response型

## 16.1 Meal

```ts id="meal-response-type"
type Meal = {
  id: number;
  recordDate: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  calcium: number | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};
```

## 16.2 Condition

```ts id="condition-response-type"
type Condition = {
  id: number;
  recordDate: string;
  weight: number | null;
  waist: number | null;
  armCircumference: number | null;
  sleepHours: number | null;
  conditionScore: number | null;
  createdAt: string;
  updatedAt: string;
};
```

## 16.3 Workout

```ts id="workout-response-type"
type Workout = {
  id: number;
  recordDate: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};
```

## 16.4 API Response設計方針

* 日付は `YYYY-MM-DD` 形式のstringで返す
* 未入力項目は `null` で返す
* `userId` は画面表示に不要なため返さない
* `id` は画面表示には使わないが、API responseには含めてもよい
* `createdAt` / `updatedAt` は初期画面では表示しないが、将来的な確認用として返してもよい

---

## 17. DB設計との対応

## 17.1 DBモデル一覧

DB上では、以下のモデルを扱う。

| モデル       | 内容    |
| --------- | ----- |
| User      | 利用者   |
| Meal      | 食事記録  |
| Condition | 体調記録  |
| Workout   | 筋トレ記録 |

## 17.2 一意制約

各記録テーブルでは、以下の一意制約を持つ。

```text id="unique-record-rule"
userId + recordDate
```

対象モデル：

* Meal
* Condition
* Workout

理由：

* 1ユーザーにつき1日1件の記録とするため
* 同一日の保存は新規追加ではなく上書き更新として扱うため

## 17.3 DB型の基本方針

| 項目             | DB型方針           |
| -------------- | --------------- |
| id             | Int             |
| userId         | Int             |
| recordDate     | Date            |
| calories       | Int nullable    |
| PFC            | Float nullable  |
| calcium        | Float nullable  |
| 体重・ウエスト等       | Float nullable  |
| conditionScore | Int nullable    |
| memo           | String nullable |
| createdAt      | DateTime        |
| updatedAt      | DateTime        |

---

## 18. 表示形式

## 18.1 食事記録の表示

| 項目       | 表示形式        |
| -------- | ----------- |
| calories | `2300 kcal` |
| protein  | `120 g`     |
| fat      | `60 g`      |
| carbs    | `250 g`     |
| calcium  | `750 mg`    |
| memo     | 入力された文字列    |

## 18.2 体調記録の表示

| 項目               | 表示形式      |
| ---------------- | --------- |
| weight           | `72.5 kg` |
| waist            | `84.0 cm` |
| armCircumference | `34.0 cm` |
| sleepHours       | `7.0 時間`  |
| conditionScore   | `4 良い`    |

## 18.3 筋トレ記録の表示

| 項目   | 表示形式     |
| ---- | -------- |
| memo | 入力された文字列 |

## 18.4 未入力値の表示

未入力値は、画面上では以下のいずれかで表示する。

| 表示    | 用途      |
| ----- | ------- |
| 空欄    | 入力フォーム  |
| `未入力` | 詳細表示    |
| 非表示   | 一覧・簡易表示 |

初期実装では、履歴詳細では `未入力` を表示する方針とする。

---

## 19. 削除時のデータ扱い

## 19.1 日次一括削除

日次一括削除では、指定日の以下の記録をまとめて削除する。

* Meal
* Condition
* Workout

対象日は `recordDate` で指定する。

```text id="daily-delete-policy"
delete where:
userId = currentUser.id
recordDate = 指定日
```

## 19.2 個別削除

初期実装では、Mealのみ削除、Conditionのみ削除、Workoutのみ削除といった個別削除は扱わない。

個別削除は将来課題とする。

---

## 20. 初期実装スコープ

初期実装で扱うデータ項目は以下とする。

* User
* Meal
* Condition
* Workout
* MonthlyHistory
* DailyHistory
* AuthUser
* MealFormState
* ConditionFormState
* WorkoutFormState
* SaveMealInput
* SaveConditionInput
* SaveWorkoutInput

---

## 21. 初期実装では扱わない項目

初期実装では以下を扱わない。

* 食事ごとの明細
* 食材マスタ
* 栄養素マスタ
* 目標カロリー
* 目標PFC
* 体脂肪率
* 血圧
* 心拍数
* 歩数
* 有酸素運動記録
* 筋トレ種目マスタ
* 重量・回数・セット数の構造化
* 写真アップロード
* 体重推移グラフ
* 複数ユーザー共有
* 管理者用データ

---

## 22. 将来課題

## 22.1 食事記録の詳細化

将来的に、以下のような詳細化を検討する。

* 食事タイミング
* 食材ごとの記録
* 食事写真
* 食材マスタ
* 栄養素マスタ
* 目標値との差分

## 22.2 体調記録の詳細化

将来的に、以下のような詳細化を検討する。

* 体脂肪率
* 血圧
* 心拍数
* 疲労度
* 筋肉痛
* 便通
* ストレス
* 気分

## 22.3 筋トレ記録の構造化

将来的に、筋トレ記録を以下のように構造化することを検討する。

* 種目
* 重量
* 回数
* セット数
* RPE
* 部位
* トレーニング時間

## 22.4 表示・分析用データ

将来的に、以下のような表示・分析用データを検討する。

* 体重推移（→ v2で週間グラフとして実現。12.3 / 12.4 参照）
* 摂取カロリー推移（→ v2で実現。12.4 参照）
* PFC推移（→ v2で実現。12.4 参照）
* 体調スコア推移（→ v2で実現。12.4 参照）
* 筋トレ実施日数
* 月次サマリー

---

## 23. 後続設計書への引き継ぎ

| 後続資料           | 引き継ぐ内容                                  |
| -------------- | --------------------------------------- |
| バリデーション・エラー設計書 | 必須/任意、数値範囲、文字数、エラーメッセージ                 |
| 状態管理・データフロー設計書 | FormStateからAPI requestへの変換、取得データのフォーム反映 |
| フロントエンド設計書     | 型定義、フォーム状態、API request / response       |
| API設計書         | request / response schema、nullの扱い       |
| 認証・認可設計書       | User.cognitoSub、userIdをクライアントから受け取らない方針 |
| テスト観点表         | 空値、部分入力、全項目空、数値変換、日付、削除                 |
| ADR / 設計判断メモ   | 1日1件、自由テキスト、部分入力許可、完全空保存不可              |
