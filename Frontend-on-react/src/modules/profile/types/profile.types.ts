export interface ManagerResponseDto {
  id: number
  username: string
  fullName: string
  role: string
  isBlocked: boolean
}

export interface UpdateProfileDto {
  fullName: string
}

export interface ChangePasswordDto {
  currentPassword: string
  newPassword: string
}