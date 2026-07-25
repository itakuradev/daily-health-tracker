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
 * ユーザーへ表示する文言（Access Token や内部エラーの詳細は含めない）。
 * 認証切れは 401、認証サービスの一時障害は 503 として扱う。
 */
const AUTH_EXPIRED_MESSAGE =
  '認証の有効期限が切れました。再度ログインしてください。';
const AUTH_UNAVAILABLE_MESSAGE =
  '認証サービスに一時的に接続できません。しばらくして再度お試しください。';

/**
 * 再試行後もなお 401 だった場合、または再ログインが必要と判断した場合に呼ばれる
 * ハンドラ。apiClient は Context に依存しないため、AuthProvider 側から
 * ログアウト処理を登録する（認証・認可設計書 21「フロントエンド」）。
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

// ---------------------------------------------------------------------------
// ログアウトの集約
//
// 複数リクエストが同時に認証切れを検知しても、ログアウト処理は一度だけ開始する。
// loggingOut は resetAuthClientState() でリセットする（ログアウト完了・再サインイン時）。
// ---------------------------------------------------------------------------
let loggingOut = false;

function triggerLogout(): void {
  if (loggingOut) return;
  loggingOut = true;
  onUnauthorized?.();
}

// ---------------------------------------------------------------------------
// Token 更新の集約
//
// 同じ Access Token を使った複数リクエストが同時に 401 を返しても、
// forceRefresh は原則 1 回だけ実行する。
//
// - 同時実行中の更新は inflightRefresh を共有する。
// - 更新完了後に遅れて 401 が返ったリクエストは、tokenGeneration の進みを見て
//   「すでに別リクエストが更新済み」と判断し、再度 forceRefresh せず新しい token を使う。
//   （単純な in-flight 共有だけでは、更新完了直後の遅延 401 で二重更新が起こりうる。）
//
// 生の文字列比較ではなく単調増加の世代番号で判断するため、時間差で古い token が
// 混ざっても誤って古い token を再利用しない。
// ---------------------------------------------------------------------------
type RefreshOutcome =
  | { status: 'refreshed'; token: string }
  /** セッション・Refresh Token が失効し再ログインが必要（Amplify が token をクリア） */
  | { status: 'unauthenticated' }
  /** ネットワーク・Cognito の一時障害、または分類不能（ログアウトしない） */
  | { status: 'unavailable' };

let tokenGeneration = 0;
let currentToken: string | undefined;
let inflightRefresh: Promise<RefreshOutcome> | null = null;

/**
 * forceRefresh を実際に実行する。
 *
 * aws-amplify 6 の `fetchAuthSession({ forceRefresh: true })` は、
 * Amplify 自身が失敗原因を分類する（TokenOrchestrator.handleErrors）。
 *   - 再ログインが必要な失敗（Refresh Token 失効など）: token をクリアし、
 *     例外を投げずに token 不在のセッションを返す
 *   - 一時的な通信・サービス障害／予期しないエラー: token を保持したまま throw する
 *
 * よってエラー名の文字列判定は行わず、「token 不在で解決 = 要再ログイン」
 * 「throw = 一時障害/分類不能」という公式契約で分類する。
 */
async function runForceRefresh(): Promise<RefreshOutcome> {
  let token: string | undefined;
  try {
    const session = await fetchAuthSession({ forceRefresh: true });
    token = session.tokens?.accessToken?.toString();
  } catch {
    // 一時障害・予期しないエラー。誤ってログアウトさせないため unavailable とする。
    return { status: 'unavailable' };
  }

  if (!token) {
    // Amplify が token をクリアした = 再ログインが必要。
    return { status: 'unauthenticated' };
  }

  currentToken = token;
  tokenGeneration += 1;
  return { status: 'refreshed', token };
}

/**
 * Access Token を更新する。同時・遅延の 401 をまたいで forceRefresh を集約する。
 *
 * @param sentGeneration 401 になったリクエストが token を取得した時点の世代番号
 */
function refreshAccessToken(sentGeneration: number): Promise<RefreshOutcome> {
  // このリクエスト送信後に別リクエストが更新を完了していれば、再更新せず新しい token を使う。
  if (tokenGeneration > sentGeneration && currentToken) {
    return Promise.resolve({ status: 'refreshed', token: currentToken });
  }

  // 同時実行中の更新は共有する。
  if (!inflightRefresh) {
    inflightRefresh = runForceRefresh().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

/**
 * ログアウト完了時・再サインイン時に、認証まわりの制御状態をリセットする。
 * 永久にログアウトや更新が抑止されたままにならないようにする。
 */
export function resetAuthClientState(): void {
  loggingOut = false;
  inflightRefresh = null;
  currentToken = undefined;
  tokenGeneration = 0;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** 認証必須APIかどうか。デフォルト true */
  requiresAuth?: boolean;
}

/**
 * 共通API通信処理。
 *
 * 認証必須APIでは Amplify Auth から Access Token を取得し
 * `Authorization: Bearer` を付与する（認証・認可設計書 8.1）。
 *
 * 401 時は token を更新して同一リクエストを1回だけ再試行する。
 * 再試行してもなお 401 なら回復不能とみなしログアウトする
 * （認証・認可設計書 17.1）。403・429・5xx・ネットワークエラーは再試行しない。
 *
 * @param retryToken 再送時に使用する更新後の Access Token。指定時は再送とみなす。
 */
async function request<T>(
  path: string,
  options: RequestOptions = {},
  retryToken?: string,
): Promise<T> {
  const requiresAuth = options.requiresAuth ?? true;
  const isRetry = retryToken !== undefined;
  const sentGeneration = tokenGeneration;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    let token: string | undefined;
    if (isRetry) {
      token = retryToken;
    } else {
      try {
        const session = await fetchAuthSession();
        token = session.tokens?.accessToken?.toString();
      } catch {
        // 初回のセッション取得失敗。生の Amplify 例外を UI へ出さず一時障害として扱う。
        throw new ApiError(503, AUTH_UNAVAILABLE_MESSAGE);
      }
    }
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
    // ネットワーク接続エラー（サーバー未起動など）。再試行・ログアウトしない。
    throw new ApiError(0, 'サーバーに接続できません。バックエンドが起動しているか確認してください。');
  }

  // 認証切れ: token を更新して1回だけ再試行する（403・429・5xx は対象外）。
  if (res.status === 401 && requiresAuth) {
    if (!isRetry) {
      const outcome = await refreshAccessToken(sentGeneration);

      if (outcome.status === 'refreshed') {
        return request<T>(path, options, outcome.token);
      }
      if (outcome.status === 'unauthenticated') {
        // 再ログインが必要。ログアウトは集約され一度だけ開始される。
        triggerLogout();
        throw new ApiError(401, AUTH_EXPIRED_MESSAGE);
      }
      // unavailable: 一時障害。ログアウトも認証状態の破棄も行わない。
      throw new ApiError(503, AUTH_UNAVAILABLE_MESSAGE);
    }

    // 更新後の token で再送してもなお 401。回復不能とみなしログアウトする（集約）。
    triggerLogout();
    throw new ApiError(401, AUTH_EXPIRED_MESSAGE);
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
