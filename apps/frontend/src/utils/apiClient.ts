const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/**
 * fetch のラッパー。
 * - ベース URL を自動付与
 * - Content-Type: application/json を付与
 * - X-User-Id ヘッダーを付与（開発用モック認証）
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  userId: number,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': String(userId),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  // 204 No Content など body がない場合は null を返す
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
