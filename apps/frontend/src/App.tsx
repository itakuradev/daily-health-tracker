import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import DailyPage from './pages/DailyPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />

          {/* ログイン済みユーザーのみアクセス可能なルート */}
          <Route element={<PrivateRoute />}>
            <Route path="/daily"   element={<DailyPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
