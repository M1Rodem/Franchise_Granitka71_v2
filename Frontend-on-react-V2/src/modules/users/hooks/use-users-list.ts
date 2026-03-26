import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { usersApi } from "@/modules/users/api/users.api"
import { usersKeys } from "@/modules/users/lib/users.keys"

import type { UsersListQueryParams } from "@/modules/users/types/users.types"

export function useUsersList(params: UsersListQueryParams) {

  return useQuery({
    queryKey: usersKeys.list(params),

    queryFn: () =>
      usersApi.getUsersPaged(params),

    staleTime: 30_000,

    refetchOnWindowFocus: false,

    placeholderData: keepPreviousData,
  })
}