import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * 未ログイン時にログイン画面へリダイレクトするルートガード。
 * App.tsx で保護したいルートを <PrivateRoute> で囲む。
 *
 * 使用例:
 *   <Route element={<PrivateRoute />}>
 *     <Route path="/daily" element={<DailyPage />} />
 *     <Route path="/history" element={<HistoryPage />} />
 *   </Route>
 */
export default function PrivateRoute() {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Outlet /> : <Navigate to="/" replace />;
}
