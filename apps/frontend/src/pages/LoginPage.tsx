import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();

  // 認証状態確認中／callback処理中は遷移判定せず待機する（認証・認可設計書 12.2）。
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.subtitle}>読み込み中...</p>
        </div>
      </div>
    );
  }

  // 認証済みユーザーは日次記録画面へ（認証・認可設計書 12.3）。
  if (isAuthenticated) {
    return <Navigate to="/daily" replace />;
  }

  const handleLogin = () => {
    // Cognito Managed Login へリダイレクトする。戻り先は callback（ルート）。
    void login();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>健康管理マスター</h1>
        <p style={styles.subtitle}>食事・体調・筋トレを記録するアプリ</p>
        <button style={styles.button} onClick={handleLogin}>
          ログインする
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '48px 40px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: 360,
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#2e7d32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
  },
  button: {
    background: '#43a047',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginBottom: 12,
  },
  note: {
    fontSize: 12,
    color: '#999',
  },
};
