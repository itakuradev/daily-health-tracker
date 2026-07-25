import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  ApiError,
  apiClient,
  resetAuthClientState,
  setUnauthorizedHandler,
} from './apiClient';

// aws-amplify/auth をモックする（実 Amplify を読み込まない）。
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

const mockedFetchAuthSession = vi.mocked(fetchAuthSession);

// ---- ヘルパー -------------------------------------------------------------

/** fetch のレスポンスを模した最小オブジェクト（apiClient は ok/status/text のみ使用） */
function fakeResponse(status: number, body: unknown = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

/** accessToken を持つ / 持たないセッションを作る */
function sessionWith(token?: string) {
  return {
    tokens: token ? { accessToken: { toString: () => token } } : undefined,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** fetchAuthSession の forceRefresh:true での呼び出し回数 */
function forceRefreshCount(): number {
  return mockedFetchAuthSession.mock.calls.filter(
    ([opts]) => (opts as { forceRefresh?: boolean } | undefined)?.forceRefresh,
  ).length;
}

/** fetch 呼び出しに付与された Authorization ヘッダーを取り出す */
function authHeaderOf(callIndex: number): string | undefined {
  const call = mockedFetch.mock.calls[callIndex];
  const init = call?.[1] as { headers?: Record<string, string> } | undefined;
  return init?.headers?.Authorization;
}

let mockedFetch: Mock;
let onUnauthorized: Mock<() => void>;

beforeEach(() => {
  resetAuthClientState();
  mockedFetchAuthSession.mockReset();
  mockedFetch = vi.fn();
  vi.stubGlobal('fetch', mockedFetch);
  onUnauthorized = vi.fn<() => void>();
  setUnauthorizedHandler(onUnauthorized);
});

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

// ---- 正常系 ---------------------------------------------------------------

describe('正常系', () => {
  it('200 を返した場合、Token 更新せず結果を返す', async () => {
    mockedFetchAuthSession.mockResolvedValue(sessionWith('T0') as never);
    mockedFetch.mockResolvedValue(fakeResponse(200, { value: 1 }));

    const result = await apiClient.get<{ value: number }>('/api/meals');

    expect(result).toEqual({ value: 1 });
    expect(forceRefreshCount()).toBe(0);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(authHeaderOf(0)).toBe('Bearer T0');
  });

  it('認証不要リクエストでは Access Token 取得も Token 更新も行わない', async () => {
    mockedFetch.mockResolvedValue(fakeResponse(200, { status: 'ok' }));

    await apiClient.get('/api/health', { requiresAuth: false });

    expect(mockedFetchAuthSession).not.toHaveBeenCalled();
    expect(authHeaderOf(0)).toBeUndefined();
  });

  it('POST は body を JSON 化して送信する', async () => {
    mockedFetchAuthSession.mockResolvedValue(sessionWith('T0') as never);
    mockedFetch.mockResolvedValue(fakeResponse(200, { id: 1 }));

    await apiClient.post('/api/meals', { calories: 100 });

    const init = mockedFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ calories: 100 }));
  });

  it('DELETE はボディなしで送信し、空レスポンスを null で返す', async () => {
    mockedFetchAuthSession.mockResolvedValue(sessionWith('T0') as never);
    mockedFetch.mockResolvedValue(fakeResponse(200));

    const result = await apiClient.delete('/api/history/daily');

    expect(result).toBeNull();
    expect((mockedFetch.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });
});

describe('エラーレスポンスの整形', () => {
  it('message が配列ならスラッシュ区切りで連結する', async () => {
    mockedFetchAuthSession.mockResolvedValue(sessionWith('T0') as never);
    mockedFetch.mockResolvedValue(
      fakeResponse(400, { message: ['A は必須', 'B は数値'] }),
    );

    const error = (await apiClient
      .post('/api/meals', {})
      .catch((e: unknown) => e)) as ApiError;

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('A は必須 / B は数値');
  });

  it('message が文字列ならそのまま使う', async () => {
    mockedFetchAuthSession.mockResolvedValue(sessionWith('T0') as never);
    mockedFetch.mockResolvedValue(
      fakeResponse(400, { message: '不正な日付です' }),
    );

    const error = (await apiClient
      .get('/api/meals')
      .catch((e: unknown) => e)) as ApiError;

    expect(error.message).toBe('不正な日付です');
  });

  it('JSON でない本文はそのままメッセージにする', async () => {
    mockedFetchAuthSession.mockResolvedValue(sessionWith('T0') as never);
    mockedFetch.mockResolvedValue(fakeResponse(500, 'Internal Server Error'));
    // fakeResponse は JSON.stringify するため、非 JSON 本文を別途用意する
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('Bad Gateway'),
    } as unknown as Response);

    const error = (await apiClient
      .get('/api/meals')
      .catch((e: unknown) => e)) as ApiError;

    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Bad Gateway');
  });
});

// ---- 通常の 401 再試行 ----------------------------------------------------

describe('通常の 401 再試行', () => {
  it('1回目が401なら Token を更新して1回だけ再送する', async () => {
    mockedFetchAuthSession.mockImplementation((opts) =>
      Promise.resolve(
        (opts?.forceRefresh ? sessionWith('T1') : sessionWith('T0')) as never,
      ),
    );
    mockedFetch
      .mockResolvedValueOnce(fakeResponse(401))
      .mockResolvedValueOnce(fakeResponse(200, { value: 2 }));

    const result = await apiClient.get<{ value: number }>('/api/meals');

    expect(result).toEqual({ value: 2 });
    expect(forceRefreshCount()).toBe(1);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(authHeaderOf(0)).toBe('Bearer T0');
    expect(authHeaderOf(1)).toBe('Bearer T1'); // 再送は更新後 token
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('再送も401なら3回目を送らずログアウトを開始する', async () => {
    mockedFetchAuthSession.mockImplementation((opts) =>
      Promise.resolve(
        (opts?.forceRefresh ? sessionWith('T1') : sessionWith('T0')) as never,
      ),
    );
    mockedFetch.mockResolvedValue(fakeResponse(401));

    await expect(apiClient.get('/api/meals')).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(mockedFetch).toHaveBeenCalledTimes(2); // 無限再試行しない
    expect(forceRefreshCount()).toBe(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

// ---- 並行 401 -------------------------------------------------------------

describe('並行 401', () => {
  it('同じ Token の複数リクエストが同時に401でも forceRefresh は1回だけ', async () => {
    const force = deferred<ReturnType<typeof sessionWith>>();
    mockedFetchAuthSession.mockImplementation((opts) =>
      opts?.forceRefresh
        ? (force.promise as never)
        : (Promise.resolve(sessionWith('T0')) as never),
    );
    // 旧 token は 401、更新後 token は 200 を返す。
    mockedFetch.mockImplementation((_url, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      return Promise.resolve(
        auth === 'Bearer T1' ? fakeResponse(200, { ok: true }) : fakeResponse(401),
      );
    });

    const p1 = apiClient.get('/api/meals');
    const p2 = apiClient.get('/api/conditions');
    const p3 = apiClient.get('/api/workouts');

    // 3件が forceRefresh 待ちに入るまで進める
    await Promise.resolve();
    await Promise.resolve();
    force.resolve(sessionWith('T1'));

    await Promise.all([p1, p2, p3]);

    expect(forceRefreshCount()).toBe(1); // 1回だけ
    // 各リクエストの再送は更新後 token（T1）で行われる
    const retryAuths = mockedFetch.mock.calls
      .map((_c, i) => authHeaderOf(i))
      .filter((a) => a === 'Bearer T1');
    expect(retryAuths).toHaveLength(3);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('並行リクエストの再送もすべて401なら、ログアウトは1回だけ', async () => {
    mockedFetchAuthSession.mockImplementation((opts) =>
      Promise.resolve(
        (opts?.forceRefresh ? sessionWith('T1') : sessionWith('T0')) as never,
      ),
    );
    mockedFetch.mockResolvedValue(fakeResponse(401)); // 常に401

    const results = await Promise.allSettled([
      apiClient.get('/api/meals'),
      apiClient.get('/api/conditions'),
      apiClient.get('/api/workouts'),
    ]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(forceRefreshCount()).toBe(1); // 更新も1回だけ
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('更新完了後に遅れて返った401は、再度 forceRefresh せず更新後 token で再送する', async () => {
    mockedFetchAuthSession.mockImplementation((opts) =>
      Promise.resolve(
        (opts?.forceRefresh ? sessionWith('T1') : sessionWith('T0')) as never,
      ),
    );
    // B の初回401だけ遅延させる
    const bFirst = deferred<Response>();
    mockedFetch.mockImplementation((url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      if (auth === 'Bearer T1') return Promise.resolve(fakeResponse(200, { ok: true }));
      // 旧 token での初回リクエスト
      if (url.includes('/api/conditions')) return bFirst.promise; // B は保留
      return Promise.resolve(fakeResponse(401)); // A は即401
    });

    const pa = apiClient.get('/api/meals'); // A: 401 → 更新 → 再送成功
    const pb = apiClient.get('/api/conditions'); // B: sentGeneration=0 を捕捉済み

    await pa; // A 完了（更新は1回）
    expect(forceRefreshCount()).toBe(1);

    // A の更新完了後に B の初回401が返る
    bFirst.resolve(fakeResponse(401));
    await pb;

    expect(forceRefreshCount()).toBe(1); // B は再更新しない
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

// ---- Token 更新失敗 -------------------------------------------------------

describe('Token 更新失敗の分類', () => {
  it('再ログインが必要な失敗（token なしで解決）ではログアウトを1回だけ実行する', async () => {
    // forceRefresh は token なしのセッションで解決（Amplify が token をクリアした状態）
    mockedFetchAuthSession.mockImplementation((opts) =>
      Promise.resolve(
        (opts?.forceRefresh ? sessionWith(undefined) : sessionWith('T0')) as never,
      ),
    );
    mockedFetch.mockResolvedValue(fakeResponse(401));

    await expect(apiClient.get('/api/meals')).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    // token なしなので再送はされない（初回のみ）
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('ネットワーク障害（forceRefresh が throw）ではログアウトせず503にする', async () => {
    mockedFetchAuthSession.mockImplementation((opts) => {
      if (opts?.forceRefresh) return Promise.reject(new Error('Network error'));
      return Promise.resolve(sessionWith('T0') as never);
    });
    mockedFetch.mockResolvedValue(fakeResponse(401));

    const error = await apiClient.get('/api/meals').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(503);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('Cognito の一時障害（service error を throw）でもログアウトしない', async () => {
    const serviceError = Object.assign(new Error('service unavailable'), {
      name: 'TooManyRequestsException',
    });
    mockedFetchAuthSession.mockImplementation((opts) => {
      if (opts?.forceRefresh) return Promise.reject(serviceError);
      return Promise.resolve(sessionWith('T0') as never);
    });
    mockedFetch.mockResolvedValue(fakeResponse(401));

    const error = await apiClient.get('/api/meals').catch((e: unknown) => e);

    expect((error as ApiError).statusCode).toBe(503);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('分類不能な例外でも誤ってログアウトしない', async () => {
    mockedFetchAuthSession.mockImplementation((opts) => {
      if (opts?.forceRefresh) return Promise.reject('weird non-error throw');
      return Promise.resolve(sessionWith('T0') as never);
    });
    mockedFetch.mockResolvedValue(fakeResponse(401));

    const error = await apiClient.get('/api/meals').catch((e: unknown) => e);

    expect((error as ApiError).statusCode).toBe(503);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('エラーに Access Token や機密情報を含めない', async () => {
    mockedFetchAuthSession.mockImplementation((opts) => {
      if (opts?.forceRefresh) {
        return Promise.reject(new Error('secret-internal-detail SUPERSECRETTOKEN'));
      }
      return Promise.resolve(sessionWith('SUPERSECRETTOKEN') as never);
    });
    mockedFetch.mockResolvedValue(fakeResponse(401));

    const error = (await apiClient
      .get('/api/meals')
      .catch((e: unknown) => e)) as ApiError;

    expect(error.message).not.toContain('SUPERSECRETTOKEN');
    expect(error.message).not.toContain('secret-internal-detail');
  });
});

// ---- 401 以外 -------------------------------------------------------------

describe('401 以外はToken更新・ログアウトしない', () => {
  it.each([403, 429, 500, 502, 503])(
    'ステータス %i では forceRefresh もログアウトもしない',
    async (status) => {
      mockedFetchAuthSession.mockResolvedValue(sessionWith('T0') as never);
      mockedFetch.mockResolvedValue(fakeResponse(status, { statusCode: status }));

      await expect(apiClient.get('/api/meals')).rejects.toMatchObject({
        statusCode: status,
      });

      expect(forceRefreshCount()).toBe(0);
      expect(onUnauthorized).not.toHaveBeenCalled();
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    },
  );

  it('通常のネットワークエラーでは forceRefresh もログアウトもしない', async () => {
    mockedFetchAuthSession.mockResolvedValue(sessionWith('T0') as never);
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await apiClient.get('/api/meals').catch((e: unknown) => e);

    expect((error as ApiError).statusCode).toBe(0);
    expect(forceRefreshCount()).toBe(0);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('初回のセッション取得が throw した場合は503にしログアウトしない', async () => {
    // 初回（非 forceRefresh）の fetchAuthSession が例外を投げるケース。
    mockedFetchAuthSession.mockRejectedValue(new Error('amplify boom'));
    mockedFetch.mockResolvedValue(fakeResponse(200, { value: 1 }));

    const error = (await apiClient
      .get('/api/meals')
      .catch((e: unknown) => e)) as ApiError;

    expect(error.statusCode).toBe(503);
    expect(error.message).not.toContain('amplify boom');
    expect(mockedFetch).not.toHaveBeenCalled(); // token 取得前に中断
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
