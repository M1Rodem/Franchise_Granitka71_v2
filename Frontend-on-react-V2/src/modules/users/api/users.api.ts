import { httpClient } from "@/shared/api/http-client"

import type {
  UsersListQueryParams,
  PagedResponse,
  UserDto,
  UserDetailsDto,
  CreateUserDto,
  UpdateUserDto,
  ChangeRoleDto,
} from "@/modules/users/types/users.types"

export const usersApi = {

  async getUsersPaged(
    params: UsersListQueryParams
  ): Promise<PagedResponse<UserDto>> {

    const response = await httpClient.get("/api/Users/paged", {
      params: {
        searchQuery: params.searchQuery || undefined,
        role: params.role || undefined,
        page: params.page,
        pageSize: params.pageSize,
      },
    })

    return response.data
  },

  async getUserById(id: number): Promise<UserDetailsDto> {

    const response = await httpClient.get(`/api/Users/${id}`)

    return response.data
  },

  async createUser(payload: CreateUserDto): Promise<void> {

    await httpClient.post("/api/Users", payload)
  },

  async updateUser(
    id: number,
    payload: UpdateUserDto
  ): Promise<void> {

    await httpClient.put(`/api/Users/${id}`, payload)
  },

  async deleteUser(id: number): Promise<void> {

    await httpClient.delete(`/api/Users/${id}`)
  },

  async changeRole(
    id: number,
    payload: ChangeRoleDto
  ): Promise<void> {

    await httpClient.post(
      `/api/Users/${id}/change-role`,
      payload
    )
  },

  async blockUser(id: number): Promise<void> {

    await httpClient.post(`/api/Users/${id}/block`)
  },

  async unblockUser(id: number): Promise<void> {

    await httpClient.post(`/api/Users/${id}/unblock`)
  },
}