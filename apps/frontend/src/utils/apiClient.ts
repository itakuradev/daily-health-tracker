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

async function request<T>(
  path: string,
  options: RequestInit = {},
  userId: number,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': String(userId),
        ...options.headers,
      },
    });
  } catch {
    // ネットワーク接続エラー（サーバー未起動など）
    throw new ApiError(0, 'サーバーに接続できません。バックエンドが起動しているか確認してください。');
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

export function createApiClient(userId: number) {
  return {
    get<T>(path: string): Promise<T> {
      return request<T>(path, { method: 'GET' }, userId);
    },
    post<T>(path: string, body: unknown): Promise<T> {
      return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, userId);
    },
    delete<T = void>(path: string): Promise<T> {
      return request<T>(path, { method: 'DELETE' }, userId);
    },
  };
}
