import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import appIcon from '../assets/app-icon.png';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();

  // 認証状態確認中／callback処理中は遷移判定せず待機する（認証・認可設計書 12.2）。
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.subtitle}>読み込み中...</p>
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
    <div className={styles.container}>
      <div className={styles.card}>
        <img src={appIcon} alt="" className={styles.icon} />
        <h1 className={styles.title}>Health Tracker</h1>
        <p className={styles.subtitle}>食事・体調・筋トレを記録するアプリ</p>
        <button type="button" className={styles.button} onClick={handleLogin}>
          ログインする
        </button>
      </div>
    </div>
  );
}
