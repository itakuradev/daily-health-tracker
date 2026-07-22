import { fetchAuthSession } from 'aws-amplify/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** バックエンドの統一エラーレスポンス型 */
interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * 再試行後もなお 401 だった場合に呼ばれるハンドラ。
 *
 * apiClient は Context に依存しないため、AuthProvider 側から
 * ログアウト処理を登録する（認証・認可設計書 21「フロントエンド」）。
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** 認証必須APIかどうか。デフォルト true */
  requiresAuth?: boolean;
}

/**
 * Amplify Auth から Access Token を取得する。
 * forceRefresh 時は token を強制更新する（401 再試行時に使用）。
 */
async function getAccessToken(forceRefresh: boolean): Promise<string | undefined> {
  const session = await fetchAuthSession(forceRefresh ? { forceRefresh: true } : undefined);
  return session.tokens?.accessToken?.toString();
}

/**
 * 共通API通信処理。
 *
 * 認証必須APIでは Amplify Auth から Access Token を取得し
 * `Authorization: Bearer` を付与する（認証・認可設計書 8.1）。
 *
 * 401 時は token を強制更新して同一リクエストを1回だけ再試行する。
 * 再試行してもなお 401 なら回復不能とみなしログアウトする
 * （認証・認可設計書 17.1）。403・5xx は再試行しない。
 *
 * @param retried 再試行済みか。true の場合は token を forceRefresh してから送る。
 */
async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const requiresAuth = options.requiresAuth ?? true;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (requiresAuth) {
    const token = await getAccessToken(retried);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // ネットワーク接続エラー（サーバー未起動など）
    throw new ApiError(0, 'サーバーに接続できません。バックエンドが起動しているか確認してください。');
  }

  // 認証切れ: token を更新して1回だけ再試行する（403・5xx は対象外）。
  if (res.status === 401 && requiresAuth) {
    if (!retried) {
      return request<T>(path, options, true);
    }
    // 再試行後もなお 401。回復不能とみなしログアウトする。
    onUnauthorized?.();
  }

  if (!res.ok) {
    const text = await res.text();
    let message = `エラー ${res.status}`;
    try {
      const body: ApiErrorBody = JSON.parse(text);
      if (Array.isArray(body.message)) {
        message = body.message.join(' / ');
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // JSON でない場合はそのまま
      if (text) message = text;
    }
    throw new ApiError(res.status, message);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

/**
 * 認証必須APIを呼び出す共通クライアント。
 * 各 hook はこれを直接 import して利用する。
 */
export const apiClient = {
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' });
  },
  post<T>(
    path: string,
    body: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return request<T>(path, { ...options, method: 'POST', body });
  },
  delete<T = void>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
};
