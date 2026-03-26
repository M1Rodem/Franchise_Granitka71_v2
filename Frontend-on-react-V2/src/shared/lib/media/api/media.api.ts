import { httpClient } from '@/shared/api/http-client'

export interface TempUploadDto {
  id: number
  originalFileName: string
  size: number
  previewUrl: string
  width: number
  height: number
}

export const mediaApi = {
  async uploadTemp(file: File, type: 'photo' | 'video') {
    const formData = new FormData()
    formData.append('file', file)

    const response = await httpClient.post<TempUploadDto>(
      `/api/media/upload-temp?type=${type}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    return response.data
  },

  async deleteTemp(tempId: number) {
    await httpClient.delete(`/api/media/temp/${tempId}`)
  },
}