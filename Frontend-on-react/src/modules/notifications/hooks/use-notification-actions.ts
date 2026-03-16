import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  resolveNotification,
  postponeNotification
} from '../api/notifications.api'



export function useNotificationActions() {

  const queryClient = useQueryClient()



  const approveMutation = useMutation({

    mutationFn: (id: number) =>
      resolveNotification(id, 'Approved'),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notifications']
      })
    }

  })



  const rejectMutation = useMutation({

    mutationFn: (id: number) =>
      resolveNotification(id, 'Rejected'),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notifications']
      })
    }

  })



  const postponeMutation = useMutation({

    mutationFn: (id: number) =>
      postponeNotification(id, 30),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notifications']
      })
    }

  })



  return {

    approve: approveMutation.mutateAsync,

    reject: rejectMutation.mutateAsync,

    postpone: postponeMutation.mutateAsync

  }

}