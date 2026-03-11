import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/modules/orders/components/orders-date-input.module.css';
import { motion } from 'framer-motion';

interface OrdersDateInputProps {
  label: string;
  isoValue: string;
  onCommit: (isoDate: string) => void;
}

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const getDaysInMonth = (year: number, monthIndex: number): number => {
  if (monthIndex === 1) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [0, 2, 4, 6, 7, 9, 11].includes(monthIndex) ? 31 : 30;
};

const toIsoDate = (day: number, month: number, year: number): string => {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

const parseIsoDate = (value: string): { year: number; month: number; day: number } | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }

  const maxDay = getDaysInMonth(year, month - 1);
  if (day < 1 || day > maxDay) {
    return null;
  }

  return { year, month, day };
};

const formatIsoToDisplay = (value: string): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return '';
  }

  return `${String(parsed.day).padStart(2, '0')}.${String(parsed.month).padStart(2, '0')}.${parsed.year}`;
};

const parseDisplayToIso = (value: string): string | null => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return '';
  }

  const match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }

  const maxDay = getDaysInMonth(year, month - 1);
  if (day < 1 || day > maxDay) {
    return null;
  }

  return toIsoDate(day, month, year);
};

const maskDateDigits = (digits: string): string => {
  const safe = digits.slice(0, 8);
  const day = safe.slice(0, 2);
  const month = safe.slice(2, 4);
  const year = safe.slice(4, 8);

  if (safe.length <= 2) {
    return day;
  }
  if (safe.length <= 4) {
    return `${day}.${month}`;
  }

  return `${day}.${month}.${year}`;
};

const getCaretIndexFromDigits = (formatted: string, digitCount: number): number => {
  if (digitCount <= 0) {
    return 0;
  }

  let digitsSeen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      digitsSeen += 1;
      if (digitsSeen === digitCount) {
        return i + 1;
      }
    }
  }

  return formatted.length;
};

const getMonthStartOffset = (year: number, monthIndex: number): number => {
  const day = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return day === 0 ? 6 : day - 1;
};

const monthTitle = (year: number, monthIndex: number): string => {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, monthIndex, 1)),
  );
};

export function OrdersDateInput({ label, isoValue, onCommit }: OrdersDateInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const parsed = parseIsoDate(isoValue);
    return parsed?.year ?? new Date().getUTCFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseIsoDate(isoValue);
    return (parsed?.month ?? new Date().getUTCMonth() + 1) - 1;
  });

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const formatted = formatIsoToDisplay(isoValue);

    // Обновляем только если реально отличается
    if (document.activeElement !== input && input.value !== formatted) {
      input.value = formatted;
    }
  }, [isoValue]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      const clickedInsideInput =
        rootRef.current && rootRef.current.contains(target);

      const clickedInsidePopover =
        popoverRef.current && popoverRef.current.contains(target);

      if (!clickedInsideInput && !clickedInsidePopover) {
        setIsCalendarOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isCalendarOpen]);

  const selected = useMemo(() => parseIsoDate(isoValue), [isoValue]);

  const days = useMemo(() => {
    const total = getDaysInMonth(viewYear, viewMonth);
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }, [viewYear, viewMonth]);

  const startOffset = useMemo(() => getMonthStartOffset(viewYear, viewMonth), [viewYear, viewMonth]);

  const applyMaskedInput = (input: HTMLInputElement) => {
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length;

    const nextDigits = raw.replace(/\D/g, '').slice(0, 8);
    const masked = maskDateDigits(nextDigits);

    input.value = masked;

    const nextCaret = getCaretIndexFromDigits(masked, digitsBeforeCaret);
    window.requestAnimationFrame(() => {
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const commitFromInput = () => {
    const input = inputRef.current
    if (!input) return

    const parsed = parseDisplayToIso(input.value)

    if (parsed !== null) {
      onCommit(parsed);
      if (parsed === '') {
        input.value = '';
      } else {
        input.value = formatIsoToDisplay(parsed);
      }
    }
  };

  const selectDate = (day: number) => {
    const nextIso = toIsoDate(day, viewMonth + 1, viewYear);
    onCommit(nextIso);

    const input = inputRef.current;
    if (input) {
      input.value = formatIsoToDisplay(nextIso);
    }

    setIsCalendarOpen(false);
  };
  const goMonth = (direction: 1 | -1) => {
    const nextDate = new Date(Date.UTC(viewYear, viewMonth + direction, 1));
    setViewYear(nextDate.getUTCFullYear());
    setViewMonth(nextDate.getUTCMonth());
  };
  const toggleCalendar = () => {
    setIsCalendarOpen((value) => {
      const next = !value;
      if (next) {
        const parsed = parseIsoDate(isoValue);
        const base = parsed
          ? new Date(Date.UTC(parsed.year, parsed.month - 1, 1))
          : new Date();
        setViewYear(base.getUTCFullYear());
        setViewMonth(base.getUTCMonth());
      }
      return next;
    });
  };

  return (
    <label className={styles.field}>
      {label && <span>{label}</span>}
      <div className={styles.inputWrap} ref={rootRef}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Открыть календарь: ${label}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleCalendar}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          defaultValue={formatIsoToDisplay(isoValue)}
          placeholder="дд.мм.гггг"
          inputMode="numeric"
          autoComplete="off"
          onChange={(event) => {
            const input = event.currentTarget;

            applyMaskedInput(input);

            const parsed = parseDisplayToIso(input.value);

            if (parsed !== null) {
              onCommit(parsed);
            }
          }}
          onBlur={commitFromInput}
        />

        {isCalendarOpen &&
          createPortal(
            <motion.div
              key="calendar"
              ref={popoverRef}
              className={styles.calendarPopover}
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: rootRef.current?.getBoundingClientRect().bottom ?? 0,
                left: rootRef.current?.getBoundingClientRect().left ?? 0,
              }}
            >
              <div className={styles.calendarHeader}>
                <button type="button" onClick={() => goMonth(-1)} aria-label="Предыдущий месяц">
                  ‹
                </button>
                <strong>{monthTitle(viewYear, viewMonth)}</strong>
                <button type="button" onClick={() => goMonth(1)} aria-label="Следующий месяц">
                  ›
                </button>
              </div>

              <div className={styles.calendarWeekdays}>
                {WEEK_DAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className={styles.calendarGrid}>
                {Array.from({ length: startOffset }).map((_, idx) => (
                  <span key={`empty-${idx}`} className={styles.emptyCell} />
                ))}

                {days.map((day) => {
                  const isSelected =
                    selected?.year === viewYear &&
                    selected.month - 1 === viewMonth &&
                    selected.day === day;

                  return (
                    <button
                      key={day}
                      type="button"
                      className={isSelected ? styles.daySelected : styles.dayButton}
                      onClick={() => selectDate(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </motion.div>,
            document.body
          )}
      </div>
    </label>
  );
}
