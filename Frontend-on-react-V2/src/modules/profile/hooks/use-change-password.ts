import { useMutation } from '@tanstack/react-query'
import { profileApi } from '../api/profile.api'
import { showTempMessage } from '@/shared/ui/temp-message.service'

export function useChangePassword() {
  return useMutation({
    mutationFn: profileApi.changePassword,

    onSuccess: () => {
      showTempMessage('success', 'Пароль изменен')
    },

    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? 'Произошла ошибка при смене пароля'

      showTempMessage('error', message)
    },
  })
}