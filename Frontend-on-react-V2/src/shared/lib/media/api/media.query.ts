// import { useQuery } from '@tanstack/react-query';
// import { mediaApi } from './media.api';

// export function useOrderMedia(orderId: number) {
//   return useQuery({
//     queryKey: ['order-media', orderId],
//     queryFn: () => mediaApi.getByOrder(orderId),
//     enabled: !!orderId,
//   });
// }