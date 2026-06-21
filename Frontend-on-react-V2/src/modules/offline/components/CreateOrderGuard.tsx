import { useState, useEffect } from 'react'
import { useConnectivity } from '@/modules/offline/hooks/use-connectivity'
import { useOfflineSession } from '@/modules/offline/hooks/useOfflineSession'
import { EmployeeSelectModal } from '@/modules/offline/components/EmployeeSelectModal'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function CreateOrderGuard({ children }: Props) {
  const { isOnline } = useConnectivity()
  const { currentEmployee, hasEmployees } = useOfflineSession()
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (isOnline) {
      setIsModalOpen(false)
      return
    }

    if (!isOnline && hasEmployees === false) {
      setIsModalOpen(true)
      return
    }

    if (!isOnline && hasEmployees === true && !currentEmployee) {
      setIsModalOpen(true)
      return
    }

    setIsModalOpen(false)
  }, [isOnline, hasEmployees, currentEmployee])

  const handleModalClose = () => {
    if (!currentEmployee && hasEmployees !== false) {
      return
    }
    setIsModalOpen(false)
  }

  const canShowForm = isOnline || (currentEmployee !== null)

  if (!canShowForm) {
    return (
      <>
        <EmployeeSelectModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <p>Выбор сотрудника необходим для создания заказа</p>
        </div>
      </>
    )
  }

  return (
    <>
      <EmployeeSelectModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
      {children}
    </>
  )
}