interface Props {
  message: string | null;
  onClose?: () => void;
}

/**
 * エラーメッセージを赤いバナーで表示する共通コンポーネント。
 * message が null / 空の場合は何も表示しない。
 */
export default function ErrorBanner({ message, onClose }: Props) {
  if (!message) return null;
  return (
    <div style={s.banner} role="alert">
      <span style={s.icon}>⚠️</span>
      <span style={s.text}>{message}</span>
      {onClose && (
        <button style={s.close} onClick={onClose} aria-label="閉じる">×</button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fff3f3',
    border: '1px solid #f5c2c7',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    fontSize: 13,
    color: '#842029',
  },
  icon: { flexShrink: 0 },
  text: { flex: 1 },
  close: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#842029',
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
  },
};
