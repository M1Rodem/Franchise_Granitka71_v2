export type UserRole =
  | "Manager"
  | "Admin"
  | "SuperAdmin"

export type UserDto = {
  id: number
  username: string
  fullName: string
  role: UserRole
  isBlocked: boolean
}

export type UserDetailsDto = {
  id: number
  username: string
  fullName: string
  role: UserRole
  isBlocked: boolean
  password?: string | null
}

export type PagedResponse<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export type UsersListQueryParams = {
  searchQuery?: string
  role?: UserRole | ""
  page: number
  pageSize: number
}

export type CreateUserDto = {
  username: string
  fullName: string
  password: string
  role: UserRole
}

export type UpdateUserDto = {
  username: string
  fullName: string
  password?: string
}

export type ChangeRoleDto = {
  role: UserRole
}

export interface OfflineEmployeeDto {
  id: number
  username: string
  fullName: string
}