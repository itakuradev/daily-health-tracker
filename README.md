# 健康管理マスター

日ごとの食事・体調・筋トレ記録を管理する Web アプリ。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | NestJS + TypeScript |
| DB | PostgreSQL 16 |
| ORM | Prisma |
| 認証 (予定) | Amazon Cognito |

## ディレクトリ構成

```
daily-health-tracker/
├── apps/
│   ├── frontend/   # React + Vite アプリ
│   └── backend/    # NestJS API サーバー
├── docker-compose.yml
└── README.md
```

## ローカル開発の起動手順

### 1. PostgreSQL を起動

```bash
docker-compose up -d
```

### 2. Backend を起動

```bash
cd apps/backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

### 3. Frontend を起動

```bash
cd apps/frontend
npm install
npm run dev
```

## 環境変数

各 `.env.example` を参考に `.env` を作成してください。

- `apps/backend/.env.example`
- `apps/frontend/.env.example`
