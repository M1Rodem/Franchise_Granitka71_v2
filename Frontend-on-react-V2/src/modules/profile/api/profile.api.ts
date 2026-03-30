import { httpClient } from '@/shared/api/http-client'
import type {
  ManagerResponseDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from '../types/profile.types'

export const profileApi = {
  async getProfile(): Promise<ManagerResponseDto> {
    const response = await httpClient.get('/profile')
    return response.data
  },

  async updateProfile(payload: UpdateProfileDto): Promise<ManagerResponseDto> {
    const response = await httpClient.put(
      '/profile/update-profile',
      payload,
    )

    return response.data
  },

  async changePassword(payload: ChangePasswordDto): Promise<string> {
    const response = await httpClient.post(
      '/profile/change-password',
      payload,
    )

    return response.data
  },
}