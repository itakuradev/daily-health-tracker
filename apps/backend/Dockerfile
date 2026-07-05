# ──────────────────────────────────────────────────
# Stage 1: builder
#   - 全依存パッケージをインストール
#   - Prisma クライアントを生成
#   - TypeScript をコンパイル → dist/
# ──────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Prisma generate: schema.prisma を読んでクライアントを src/generated/prisma/ に生成
COPY prisma.config.ts ./
COPY prisma/ ./prisma/
RUN npx prisma generate

# Linux 環境の prisma generate は import パスに .ts 拡張子を使う。
# tsc コンパイル後も require("./foo.ts") のままになり Node.js が解決できないため
# コンパイル前に .ts" → .js" へ置換して Node.js CJS と互換にする。
RUN find src/generated -name "*.ts" -exec sed -i -e 's/\.ts"/\.js"/g' -e "s/\\.ts'/.js'/g" {} +

# ソースをコピーして nest build (tsc) でコンパイル
# dist/ には src/generated/prisma/ も含めてコンパイルされる
COPY . .
RUN npm run build

# ──────────────────────────────────────────────────
# Stage 2: runner (本番用軽量イメージ)
#   - 本番依存パッケージのみインストール
#   - builder の dist/ をコピー
#   - 起動時に prisma migrate deploy → node dist/main.js
# ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# コンパイル済みアプリ（生成済み Prisma クライアントも含む）
COPY --from=builder /app/dist ./dist

# マイグレーション実行に必要な設定とファイル
COPY prisma.config.ts ./
COPY prisma/ ./prisma/

EXPOSE 3000

# コンテナ起動時にマイグレーションを適用してからアプリを起動
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
