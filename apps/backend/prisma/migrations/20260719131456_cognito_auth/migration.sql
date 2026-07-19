-- Cognito 認証導入に伴う User schema の変更。
--
--   name       : String  -> String?  （UserInfo で取得できない場合を考慮し nullable 化）
--   cognitoSub : String? -> String   （認証済み User に対して必須・unique）
--
-- cognitoSub を NOT NULL にするため、Cognito に紐づかない User を先に削除する。
-- 対象は開発用の固定 seed ユーザーであり、認証を経ない User を残さない方針
-- （認証・認可設計書 18.2「固定seedユーザーの廃止」）に従う。
-- 記録データは User への外部キーを持つため、User より先に削除する。

-- 1. Cognito に紐づかない User の記録データを削除する
DELETE FROM "Meal"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "cognitoSub" IS NULL);

DELETE FROM "Condition"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "cognitoSub" IS NULL);

DELETE FROM "Workout"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "cognitoSub" IS NULL);

-- 2. Cognito に紐づかない User を削除する
DELETE FROM "User" WHERE "cognitoSub" IS NULL;

-- 3. 列の制約を変更する
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "cognitoSub" SET NOT NULL;
