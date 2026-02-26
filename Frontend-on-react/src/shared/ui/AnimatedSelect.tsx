import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './animated-select.module.css';

interface Option {
  value: string;
  label: string;
}

interface AnimatedSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}

export function AnimatedSelect({ value, options, onChange }: AnimatedSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className={styles.wrapper} ref={rootRef}>
      <motion.button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(v => !v)}
        whileTap={{ scale: 0.98 }}
      >
        {selected?.label ?? 'Выбрать'}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key={value}
            className={styles.dropdown}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 22
            }}
            >
            {options.map((option) => {
            const isSelected = option.value === value;
                
            return (
                <motion.div
                key={option.value}
                className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                }}
                whileHover={{
                    scale: 1.02,
                    backgroundColor: "rgba(90, 140, 220, 0.18)",
                }}
                transition={{ duration: 0.15 }}
                >
                {option.label}
                </motion.div>
            );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}