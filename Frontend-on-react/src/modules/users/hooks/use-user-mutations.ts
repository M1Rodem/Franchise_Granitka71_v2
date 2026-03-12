import { useMutation, useQueryClient } from "@tanstack/react-query"

import { usersApi } from "@/modules/users/api/users.api"
import { usersKeys } from "@/modules/users/lib/users.keys"
import { showTempMessage } from "@/shared/ui/temp-message.service"

import type {
  CreateUserDto,
  UpdateUserDto,
  ChangeRoleDto,
} from "@/modules/users/types/users.types"

export function useCreateUser() {

  const queryClient = useQueryClient()

  return useMutation({

    mutationFn: (payload: CreateUserDto) =>
      usersApi.createUser(payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: usersKeys.all,
      })

      showTempMessage(
        "success",
        "Пользователь успешно создан"
      )
    },
  })
}

export function useUpdateUser(id: number) {

  const queryClient = useQueryClient()

  return useMutation({

    mutationFn: (payload: UpdateUserDto) =>
      usersApi.updateUser(id, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: usersKeys.all,
      })

      showTempMessage(
        "success",
        "Пользователь обновлен"
      )
    },
  })
}

export function useChangeRole(id: number) {

  const queryClient = useQueryClient()

  return useMutation({

    mutationFn: (payload: ChangeRoleDto) =>
      usersApi.changeRole(id, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: usersKeys.all,
      })
      showTempMessage(
        "success",
        "Роль пользователя сменена"
      )
    },
  })
}

export function useBlockUser(id: number) {

  const queryClient = useQueryClient()

  return useMutation({

    mutationFn: () =>
      usersApi.blockUser(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: usersKeys.all,
      })
      showTempMessage(
        "warning",
        "Пользователь заблокирован"
      )
    },
  })
}

export function useUnblockUser(id: number) {

  const queryClient = useQueryClient()

  return useMutation({

    mutationFn: () =>
      usersApi.unblockUser(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: usersKeys.all,
      })
      showTempMessage(
        "success",
        "Пользователь разблокирован"
      )
    },
  })
}

export function useDeleteUser(userId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => usersApi.deleteUser(userId),

    onSuccess() {
      queryClient.invalidateQueries({
        queryKey: usersKeys.all
      })
      showTempMessage(
        "warning",
        "Пользователь удален"
      )
    },
  })
}