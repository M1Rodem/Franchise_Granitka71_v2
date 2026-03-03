// import { httpClient } from '@/shared/api/http-client';
// import type { MediaDto } from './media.types';
// import { env } from '@/shared/config/env';

// function normalizeUrl(url: string) {
//   if (url.startsWith('http')) return url;
//   return `${env.apiBaseUrl}${url}`;
// }

// export const mediaApi = {
//     async getByOrder(orderId: number) {
//     const { data } = await httpClient.get<MediaDto[]>(
//         `/api/media/order/${orderId}`,
//     );

//     return data.map((m) => ({
//         ...m,
//         url: normalizeUrl(m.url),
//     }));
//     },

//     async delete(id: number) {
//         await httpClient.delete(`/api/media/edit/${id}`);
//     },
// };