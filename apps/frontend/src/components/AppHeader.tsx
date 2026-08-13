import { useNavigate } from 'react-router-dom';
import { History, LogOut, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import appIcon from '../assets/app-icon.png';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
  /** ナビリンクの向き。記録画面→履歴 / 履歴画面→記録 */
  nav: 'toHistory' | 'toRecord';
}

/**
 * 共通ヘッダー。アプリアイコン + 「Health Tracker」+ ナビ + ログアウト。
 * 既存のユーザー情報表示は右側へ控えめに配置する。
 * ログアウトは既存仕様（signOut → ログイン画面へ）を維持する。
 */
export function AppHeader({ nav }: AppHeaderProps) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    void (async () => {
      await logout();
      navigate('/');
    })();
  };

  const userLabel = currentUser?.name ?? currentUser?.email ?? '';

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src={appIcon} alt="" className={styles.icon} />
        <span className={styles.title}>Health Tracker</span>
      </div>

      <nav className={styles.actions}>
        {userLabel && (
          <span className={styles.user} title={userLabel}>
            {userLabel}
          </span>
        )}

        {nav === 'toHistory' ? (
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => navigate('/history')}
          >
            <History size={18} aria-hidden="true" />
            履歴
          </button>
        ) : (
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => navigate('/daily')}
          >
            <Pencil size={18} aria-hidden="true" />
            記録
          </button>
        )}

        <button type="button" className={styles.navBtn} onClick={handleLogout}>
          <LogOut size={18} aria-hidden="true" />
          ログアウト
        </button>
      </nav>
    </header>
  );
}
