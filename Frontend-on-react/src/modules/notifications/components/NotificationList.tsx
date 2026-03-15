import { useState } from 'react'
import type { NotificationItem as Notification } from '../types/notification.types'
import { NotificationItem } from './NotificationItem'
import { NotificationModal } from './NotificationModal'

interface Props {
  notifications: Notification[]
}

export function NotificationList({ notifications }: Props) {

  const [selected, setSelected] = useState<Notification | null>(null)

  return (
    <>

      {notifications.map(n => (
        <NotificationItem
          key={n.id}
          notification={n}
          onOpen={setSelected}
        />
      ))}

      <NotificationModal
        notification={selected}
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
      />

    </>
  )
}