import type { UsersListQueryParams } from "@/modules/users/types/users.types"

export const usersKeys = {
  all: ["users"] as const,

  list: (params: UsersListQueryParams) =>
    ["users", "list", params] as const,

  detail: (id: number) =>
    ["users", "detail", id] as const,
}