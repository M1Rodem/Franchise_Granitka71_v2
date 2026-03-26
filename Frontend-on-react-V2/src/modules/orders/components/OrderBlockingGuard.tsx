import { useOrderBlocking } from '../hooks/useOrderBlocking'
import { useNavigate } from 'react-router-dom'
import { FormModal } from '@/shared/ui/modal/FormModal'
import buttonStyles from '@/shared/ui/button.module.css'
import styles from './order-blocking.module.css'
import { AppIcon } from '@/shared/ui/AppIcon'

interface Props {
  children: React.ReactNode
}

export function OrderBlockingGuard({ children }: Props) {
  const { isBlocked, blockingCount, message, isLoading } =
    useOrderBlocking()

  const navigate = useNavigate()


  if (isLoading) {
    return <div className="screen-loader">Проверка...</div>
  }

  if (!isBlocked) {
    return <>{children}</>
  }

  return (
    <FormModal
    isOpen={true}
    onClose={() => navigate('/notifications')}
    title="Действие заблокировано"
    size="sm"
    footer={
        <button
        className={`${buttonStyles.btn} ${buttonStyles.btnSuccess}`}
        onClick={() => navigate('/notifications')}
        >
        Перейти к уведомлениям
        </button>
    }
    >
    <div className={styles.blockingWrapper}>
        
        <div className={styles.blockingIcon}>
            <AppIcon name="warning" className={styles.iconSvg} />
        </div>

        <div className={styles.blockingTitle}>
        Есть незавершенные действия
        </div>

        <div className={styles.blockingText}>
        {message ??
            `Сначала выполните действия в ${blockingCount} уведомлении(ях)`}
        </div>

        <div className={styles.blockingHint}>
        После выполнения вы сможете продолжить работу
        </div>

    </div>
    </FormModal>
  )
}
