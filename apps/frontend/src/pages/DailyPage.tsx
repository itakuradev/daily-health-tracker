import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getTodayRecordDate } from '../utils/recordDate';

export default function DailyPage() {
  const { isLoggedIn, userId, logout } = useAuth();
  const navigate = useNavigate();
  const today = getTodayRecordDate();

  if (!isLoggedIn) {
    navigate('/');
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>健康管理マスター</h1>
        <button style={styles.logoutButton} onClick={handleLogout}>
          ログアウト
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.dateBar}>
          <span style={styles.dateLabel}>記録日</span>
          <span style={styles.dateValue}>{today}</span>
          <span style={styles.userId}>ユーザーID: {userId}</span>
        </div>

        <div style={styles.grid}>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>🍽️ 食事</h2>
            <p style={styles.placeholder}>Step 5 で実装予定</p>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>💪 体調</h2>
            <p style={styles.placeholder}>Step 6 (frontend) で実装予定</p>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>🏋️ 筋トレ</h2>
            <p style={styles.placeholder}>Step 6 (frontend) で実装予定</p>
          </section>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f5f5f5',
    fontFamily: 'sans-serif',
  },
  header: {
    background: '#2e7d32',
    color: '#fff',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
  },
  logoutButton: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 6,
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: 13,
  },
  main: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '24px 16px',
  },
  dateBar: {
    background: '#fff',
    borderRadius: 8,
    padding: '12px 20px',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  dateLabel: {
    fontSize: 13,
    color: '#888',
  },
  dateValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#2e7d32',
  },
  userId: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#aaa',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
    color: '#333',
  },
  placeholder: {
    fontSize: 13,
    color: '#bbb',
    fontStyle: 'italic',
  },
};
