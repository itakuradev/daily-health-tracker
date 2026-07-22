import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * 未ログイン時にログイン画面へリダイレクトするルートガード。
 * App.tsx で保護したいルートを <PrivateRoute> で囲む。
 *
 * 認証状態確認中（isLoading）は遷移判定を行わず待機する。
 * これを未認証とみなすと、リロード時や callback 処理中に
 * 認証済みでもログイン画面へ戻されてしまうため（認証・認可設計書 12.2）。
 *
 * 使用例:
 *   <Route element={<PrivateRoute />}>
 *     <Route path="/daily" element={<DailyPage />} />
 *     <Route path="/history" element={<HistoryPage />} />
 *   </Route>
 */
export default function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div style={styles.loading}>読み込み中...</div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
    fontFamily: 'sans-serif',
  },
};
