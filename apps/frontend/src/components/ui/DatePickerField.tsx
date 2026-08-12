import { useEffect, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './Button';
import {
  formatRecordDate,
  getTodayRecordDate,
  parseRecordDate,
} from '../../utils/recordDate';
import styles from './DatePickerField.module.css';

interface DatePickerFieldProps {
  /** 選択中の日付（YYYY-MM-DD） */
  value: string;
  onChange: (date: string) => void;
  /** 記録のある日（YYYY-MM-DD）。カレンダー上にマーカー表示する */
  markedDates?: Set<string>;
  /** カレンダーの表示月が変わったとき（月次マーカーの取得に使用） */
  onActiveMonthChange?: (year: number, month: number) => void;
}

/**
 * 記録画面・履歴画面で共通の日付選択UI。
 * `[ 📅 YYYY / MM / DD ] [ 今日 ]` を表示し、日付部分の押下で
 * react-calendar をポップオーバー表示する（常設はしない）。
 */
export function DatePickerField({
  value,
  onChange,
  markedDates,
  onActiveMonthChange,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ポップオーバー外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const [y, m, d] = value.split('-');

  const handleCalendarChange = (
    next: Date | [Date | null, Date | null] | null,
  ) => {
    const picked = Array.isArray(next) ? next[0] : next;
    if (picked instanceof Date) {
      onChange(formatRecordDate(picked));
      setOpen(false);
    }
  };

  return (
    <div className={styles.root} ref={containerRef}>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <CalendarIcon size={18} className={styles.triggerIcon} aria-hidden="true" />
          <span className={styles.dateText}>{`${y} / ${m} / ${d}`}</span>
        </button>
        <Button variant="secondary" onClick={() => onChange(getTodayRecordDate())}>
          今日
        </Button>
      </div>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="日付を選択">
          <Calendar
            locale="ja-JP"
            value={parseRecordDate(value)}
            onChange={handleCalendarChange}
            onActiveStartDateChange={({ activeStartDate }) => {
              if (activeStartDate) {
                onActiveMonthChange?.(
                  activeStartDate.getFullYear(),
                  activeStartDate.getMonth() + 1,
                );
              }
            }}
            tileClassName={({ date, view }) =>
              view === 'month' && markedDates?.has(formatRecordDate(date))
                ? styles.marked
                : null
            }
          />
        </div>
      )}
    </div>
  );
}
