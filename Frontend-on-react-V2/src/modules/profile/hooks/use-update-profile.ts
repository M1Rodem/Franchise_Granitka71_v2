import { useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../api/profile.api'
import { profileKeys } from '../lib/profile.keys'
import { showTempMessage } from '@/shared/ui/temp-message.service'
import { useAuthStore } from '@/shared/store/auth.store'

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: profileApi.updateProfile,

    onSuccess: (data) => {

      const authState = useAuthStore.getState()

      if (authState.user) {
        useAuthStore.setState({
          user: {
            ...authState.user,
            fullName: data.fullName,
            username: data.username,
          }
        })
      }

      queryClient.invalidateQueries({
        queryKey: profileKeys.me(),
      })

      showTempMessage('success', 'Профиль изменен')
    },

    onError: () => {
      showTempMessage('error', 'Произошла ошибка при смене профиля')
    },
  })
}