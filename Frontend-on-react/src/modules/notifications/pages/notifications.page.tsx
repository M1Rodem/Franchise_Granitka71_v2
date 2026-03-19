import { useEffect } from 'react'
import { signalRService } from '@/shared/lib/signalr/signalr.service'
import { useNotificationsTest } from '../hooks/use-notifications-test'

export function DebugSignalR() {
  useEffect(() => {
    const handler = (data: unknown) => {
      console.log('SignalR EVENT:', data)
    }

    signalRService.subscribe('receivenotification', handler)
    signalRService.subscribe('updatenotificationcount', handler)
    signalRService.subscribe('initialnotificationstate', handler)

    return () => {
      signalRService.unsubscribe('receivenotification', handler)
      signalRService.unsubscribe('updatenotificationcount', handler)
      signalRService.unsubscribe('initialnotificationstate', handler)
    }
  }, [])

  return null
}

export default function NotificationsPage() {
    useNotificationsTest()
  return (
    <>
      <DebugSignalR />
      <div>Notifications page</div>
    </>
  )
}