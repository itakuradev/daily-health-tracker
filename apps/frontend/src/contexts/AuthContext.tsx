import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchAuthSession, signInWithRedirect, signOut } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { resetAuthClientState, setUnauthorizedHandler } from '../utils/apiClient';
import type { AuthUser } from '../types/api';

interface AuthContextValue {
  /** 認証済みかどうか */
  isAuthenticated: boolean;
  /** 認証状態確認中かどうか（セッション復元中／callback処理中） */
  isLoading: boolean;
  /** 認証済みユーザー情報（画面表示用） */
  currentUser: AuthUser | null;
  /** Cognito Managed Login へのリダイレクトを開始する */
  login: () => Promise<void>;
  /** サインアウトし、認証状態を破棄する */
  logout: () => Promise<void>;
  /** 認証状態を再確認する */
  refreshAuthState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  /**
   * Amplify Auth から現在の認証状態を確認する（認証・認可設計書 6.4）。
   *
   * Access Token があれば認証済みとし、表示用の属性は ID Token の claim
   * （email / name）から取り出す。ID Token はバックエンドへ送らず、
   * フロントでのユーザー属性参照のみに使う（認証・認可設計書 7）。
   */
  const refreshAuthState = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const accessToken = session.tokens?.accessToken;

      if (!accessToken) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        return;
      }

      const idPayload = session.tokens?.idToken?.payload;
      const sub =
        (idPayload?.sub as string | undefined) ??
        (accessToken.payload.sub as string);
      const email = (idPayload?.email as string | undefined) ?? null;
      const name = (idPayload?.name as string | undefined) ?? null;

      setCurrentUser({ sub, email, name });
      setIsAuthenticated(true);
    } catch {
      // セッション取得に失敗した場合は未認証として扱う
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async () => {
    await signInWithRedirect();
  }, []);

  // 実行中のログアウト処理。複数リクエストからの同時呼び出しを1回に集約する。
  const logoutInFlight = useRef<Promise<void> | null>(null);

  const logout = useCallback(async () => {
    // すでにログアウト処理中なら、同じ処理を共有して signOut を多重実行しない。
    if (logoutInFlight.current) return logoutInFlight.current;

    const run = (async () => {
      try {
        // Cognito からサインアウトする（Managed Login のログアウトを経由し、
        // logout URL へ戻る）。取得済みデータ・フォーム状態は画面遷移で破棄される
        // （認証・認可設計書 14）。
        // redirect 型の signOut ではブラウザが遷移し、この Promise は解決前に
        // ページがアンロードされる場合がある。その場合は次回ロード時に状態が初期化される。
        await signOut();
      } finally {
        setIsAuthenticated(false);
        setCurrentUser(null);
        // apiClient 側のログアウト・更新の集約状態をリセットする
        // （永久に抑止されたままにしない）。
        resetAuthClientState();
        logoutInFlight.current = null;
      }
    })();

    logoutInFlight.current = run;
    return run;
  }, []);

  // 起動時の認証状態確認と、callback / サインイン・サインアウトの検知。
  useEffect(() => {
    void refreshAuthState();

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          // 新しいサインイン。前セッションの集約状態を破棄する。
          resetAuthClientState();
          void refreshAuthState();
          break;
        case 'signedOut':
        case 'tokenRefresh':
          void refreshAuthState();
          break;
        case 'signInWithRedirect_failure':
          setIsAuthenticated(false);
          setCurrentUser(null);
          setIsLoading(false);
          break;
      }
    });

    return unsubscribe;
  }, [refreshAuthState]);

  // 401 再試行後もなお認証切れだった場合にログアウトする
  // （apiClient は Context に依存しないためハンドラを登録する）。
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        currentUser,
        login,
        logout,
        refreshAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
