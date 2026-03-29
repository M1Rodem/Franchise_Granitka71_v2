// src/modules/orders/components/PrintTypeModal.tsx
import { FormModal } from '@/shared/ui/modal/FormModal'
import button from '@/shared/ui/button.module.css'
import styles from './PrintTypeModal.module.css'

interface PrintTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: 'default' | 'worker') => void
  isLoading: boolean
  title?: string
}

export function PrintTypeModal({ 
  isOpen, 
  onClose, 
  onSelect, 
  isLoading,
  title = 'Выберите тип печати'
}: PrintTypeModalProps) {
  const footer = (
    <div className={styles.footer}>
      <button
        type="button"
        className={`${button.btn} ${button.btnNeutral}`}
        onClick={onClose}
        disabled={isLoading}
      >
        Отмена
      </button>
    </div>
  )

  return (
    <FormModal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      footer={footer}
      size="sm"
    >
      <div className={styles.options}>
        <button
          type="button"
          className={`${button.btn} ${button.btnPrimary} ${styles.optionBtn}`}
          onClick={() => onSelect('default')}
          disabled={isLoading}
        >
          <div className={styles.optionContent}>
            <strong>Обычная печать</strong>
            <small>С ценами и данными заказчика</small>
          </div>
        </button>

        <button
          type="button"
          className={`${button.btn} ${button.btnNeutral} ${styles.optionBtn}`}
          onClick={() => onSelect('worker')}
          disabled={isLoading}
        >
          <div className={styles.optionContent}>
            <strong>Для рабочих</strong>
            <small>Без цен и личных данных</small>
          </div>
        </button>
      </div>
    </FormModal>
  )
}