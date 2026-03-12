import { useQuery } from "@tanstack/react-query"

import { usersApi } from "@/modules/users/api/users.api"
import { usersKeys } from "@/modules/users/lib/users.keys"

export function useUser(id: number | null) {

  return useQuery({
    queryKey: id ? usersKeys.detail(id) : ["users", "empty"],

    queryFn: () => {
      if (!id) throw new Error("User id missing")
      return usersApi.getUserById(id)
    },

    enabled: !!id,
  })
}