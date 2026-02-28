import { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { ordersApi } from '@/modules/orders/api/orders.api';
import { ordersKeys } from '@/modules/orders/lib/orders.keys';
import type { OrderDetailsDto } from '@/modules/orders/types/orders.types';
import { useUiStore } from '@/shared/store/ui.store';
import { ClientSection } from '@/modules/orders/components/order-details/ClientSection';
import { DeceasedSection } from '@/modules/orders/components/order-details/DeceasedSection';
import { MonumentSection } from '@/modules/orders/components/order-details/MonumentSection';
import { MetadataSection } from '@/modules/orders/components/order-details/MetadataSection';
import { InstallationSection } from '@/modules/orders/components/order-details/InstallationSection';
import { WorksSection } from '@/modules/orders/components/order-details/WorksSection';
import { PaymentsSection } from '@/modules/orders/components/order-details/PaymentsSection';
import { MediaSection } from '@/modules/orders/components/order-details/MediaSection';
import { OrderActions } from '@/modules/orders/components/order-details/OrderActions';

import styles from './order-details.page.module.css';


export default function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const setOrderDetailsHeader = useUiStore((s) => s.setOrderDetailsHeader);
  const resetHeader = useUiStore((s) => s.resetHeader);

  const numericId = useMemo(() => {
    if (!id) return null;
    const parsed = Number(id);
    return Number.isNaN(parsed) ? null : parsed;
  }, [id]);

  const { data, isLoading, isError } = useQuery<OrderDetailsDto>({
    queryKey: numericId
      ? ordersKeys.byId(numericId)
      : ['orders', 'byId', 'invalid'],
    queryFn: () => {
      if (!numericId) {
        throw new Error('Invalid order id');
      }
      return ordersApi.getById(numericId);
    },
    enabled: !!numericId,
  });

  // Устанавливаем header режим
  useEffect(() => {
    if (data) {
      setOrderDetailsHeader(data.orderNumber);
    }

    return () => {
      resetHeader();
    };
  }, [data, setOrderDetailsHeader, resetHeader]);

  // Loading
  if (isLoading) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.loader}>Загрузка заказа...</div>
      </div>
    );
  }

  // Error
  if (isError) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.error}>Ошибка загрузки заказа</div>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          ← Назад
        </button>
      </div>
    );
  }

  // Not found
  if (!data) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.error}>Заказ не найден</div>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          ← Назад
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ClientSection
        fullName={data.customerFullName}
        email={data.customerEmail}
        phone={data.phone}
        address={data.address}
      />

      <DeceasedSection
        deceasedFullName={data.deceasedFullName}
      />

      <MonumentSection
      type={data.monumentType}
      size={data.monumentSize}
      additionalInfo={data.additionalInfo}
      />

      <MetadataSection
      manager={data.managerFullName}
      orderDate={data.orderDate}
      createdAt={data.createdAt}
      updatedAt={data.updatedAt}
      />

      <InstallationSection
        plotName={data.plotName}
        place={data.place}
        inspectionPlace={data.inspectionPlace}
        latitude={data.latitude}
        longitude={data.longitude}
        distanceKm={
          data.workItems.find(w => w.distanceKm)?.distanceKm ?? null
        }
      />
      
      <WorksSection items={data.workItems} />
      <PaymentsSection items={data.payments} />
      <MediaSection items={data.photos} />

      <OrderActions orderId={data.id} />
    </div>
  );
}