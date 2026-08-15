import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import DailyPage from './pages/DailyPage';
import LoginPage from './pages/LoginPage';

// 履歴画面はグラフライブラリ(recharts)を含み重いため遅延ロードする。
// これにより初期表示（ログイン／記録画面）のバンドルから recharts を分離する。
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div style={{ padding: 24 }}>読み込み中...</div>}>
          <Routes>
            <Route path="/" element={<LoginPage />} />

            {/* ログイン済みユーザーのみアクセス可能なルート */}
            <Route element={<PrivateRoute />}>
              <Route path="/daily" element={<DailyPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
