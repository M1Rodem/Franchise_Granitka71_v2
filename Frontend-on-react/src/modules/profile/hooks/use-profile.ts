import { useQuery } from "@tanstack/react-query"

import { profileApi } from "../api/profile.api"
import { profileKeys } from "../lib/profile.keys"

import type { ManagerResponseDto } from "../types/profile.types"

export function useProfile() {

  return useQuery<ManagerResponseDto>({
    queryKey: profileKeys.me(),
    queryFn: profileApi.getProfile,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

}