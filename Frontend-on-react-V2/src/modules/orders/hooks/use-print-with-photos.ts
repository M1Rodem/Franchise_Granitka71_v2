import { useState } from 'react';
import { ordersApi } from '../api/orders.api';

export function usePrintWithPhotos() {
  const [isLoading, setIsLoading] = useState(false);

  const printWithPhotos = async (orderId: number, photoIds: number[], type: 'default' | 'worker') => {
    if (!photoIds.length) {
      console.warn('No photos selected');
      return;
    }

    setIsLoading(true);
    try {
      const blob = await ordersApi.printOrderWithPhotos(orderId, type, photoIds);
      
      // Создаем URL для блоба и открываем в новой вкладке
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      
      if (!printWindow) {
        // Если браузер заблокировал popup
        const link = document.createElement('a');
        link.href = url;
        link.download = `order_${orderId}_photos.html`;
        link.click();
      }
      
      // Очищаем URL через некоторое время
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Print with photos error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { printWithPhotos, isLoading };
}