import { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

import { UNAUTHORIZED_EVENT } from "@/shared/api/http-client"

import { profileKeys } from "@/modules/profile/lib/profile.keys"
import { profileApi } from "@/modules/profile/api/profile.api"

import { useAuthStore } from "@/shared/store/auth.store"
import { showTempMessage } from "@/shared/ui/temp-message.service"

export function RouterEvents() {

  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  // logout redirect
  useEffect(() => {

    const handler = () => navigate("/login", { replace: true })

    window.addEventListener(UNAUTHORIZED_EVENT, handler)

    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handler)
    }

  }, [navigate])

  // profile sync on navigation
  useEffect(() => {

    const syncProfile = async () => {

      const authState = useAuthStore.getState()

      if (!authState.user) return

      try {

        const profile = await queryClient.fetchQuery({
          queryKey: profileKeys.me(),
          queryFn: profileApi.getProfile,
          staleTime: 0
        })

        if (!profile) return

        const nameChanged =
          profile.fullName !== authState.user.fullName

        const usernameChanged =
          profile.username !== authState.user.username

        if (!nameChanged && !usernameChanged) {
          return
        }

        useAuthStore.setState({
          user: {
            ...authState.user,
            fullName: profile.fullName,
            username: profile.username
          }
        })

        if (nameChanged) {
          showTempMessage(
            "info",
            "Администратор изменил ваше имя/login/role"
          )
        }

      } catch {
        // ignore errors
      }

    }

    void syncProfile()

  }, [location.pathname, queryClient])

  return null
}