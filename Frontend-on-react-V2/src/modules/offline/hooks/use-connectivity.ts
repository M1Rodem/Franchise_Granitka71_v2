import { useEffect, useState } from 'react'
import { connectivityService } from '../services/connectivity.service'

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(
    connectivityService.isOnline()
  )

  useEffect(() => {
    return connectivityService.subscribe(setIsOnline)
  }, [])

  return {
    isOnline,
  }
}