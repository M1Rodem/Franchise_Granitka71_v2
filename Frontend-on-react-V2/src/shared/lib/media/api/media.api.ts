import { httpClient } from '@/shared/api/http-client'
import { compressImage } from '@/shared/lib/media/compress-image'

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
    let finalFile = file

    if (type === 'photo') {
      try {
        finalFile = await compressImage(file)
      } catch (e) {
        console.warn('Compression failed, fallback to original', e)
      }
    }

    const formData = new FormData()
    formData.append('file', finalFile)

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