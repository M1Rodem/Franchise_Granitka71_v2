import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UNAUTHORIZED_EVENT } from '@/shared/api/http-client'

export function RouterEvents() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => navigate('/login', { replace: true })

    window.addEventListener(UNAUTHORIZED_EVENT, handler)

    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handler)
    }
  }, [navigate])

  return null
}