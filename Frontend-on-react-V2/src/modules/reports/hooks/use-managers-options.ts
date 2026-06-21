import { useQuery } from '@tanstack/react-query'

import { usersApi } from '@/modules/users/api/users.api'

export function useManagersOptions() {
  return useQuery({
    queryKey: ['users', 'report-users'],
    queryFn: async () => {
      const response = await usersApi.getUsersPaged({
        page: 1,
        pageSize: 100,
      })

      return response.items.map(user => ({
        value: String(user.id),
        label: user.fullName,
        }))
    },
  })
}