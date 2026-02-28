import { AnimatePresence, motion } from 'framer-motion';
import { useConfirmModalStore } from './modal.store';
import styles from './confirm-modal.module.css';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

export function ConfirmModal() {
  const {
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    close,
  } = useConfirmModalStore();

  const handleConfirm = () => {
    onConfirm?.();
    close();
  };

    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
            close();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, close]);

    return createPortal(
    <AnimatePresence>
        {isOpen && (
        <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
        >
            <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            >
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.message}>{message}</p>

            <div className={styles.actions}>
                <button
                type="button"
                className={styles.cancelButton}
                onClick={close}
                >
                {cancelText}
                </button>

                <button
                type="button"
                className={styles.confirmButton}
                onClick={handleConfirm}
                >
                {confirmText}
                </button>
            </div>
            </motion.div>
        </motion.div>
        )}
    </AnimatePresence>,
    document.body
    );
}