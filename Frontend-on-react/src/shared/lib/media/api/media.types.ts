export interface MediaDto {
  id: number;
  url: string;
  originalFileName: string;
  size: number;
  uploadedAt: string;
  width: number;
  height: number;
  mediaType: number | string;
}