import { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { ordersApi } from '@/modules/orders/api/orders.api';
import { ordersKeys } from '@/modules/orders/lib/orders.keys';
import type { OrderDetailsDto } from '@/modules/orders/types/orders.types';
import { usePlots } from '@/modules/plots/hooks/use-plots';
import { useUiStore } from '@/shared/store/ui.store';
import { ClientSection } from '@/modules/orders/components/order-details/ClientSection';
import { DeceasedSection } from '@/modules/orders/components/order-details/DeceasedSection';
import { MonumentSection } from '@/modules/orders/components/order-details/MonumentSection';
import { MetadataSection } from '@/modules/orders/components/order-details/MetadataSection';
import { InstallationSection } from '@/modules/orders/components/order-details/InstallationSection';
import { WorksSection } from '@/modules/orders/components/order-details/WorksSection';
import { PaymentsSection } from '@/modules/orders/components/order-details/PaymentsSection';
import { FinancialSection } from '@/modules/orders/components/order-details/FinancialSection';
import { MediaSection } from '@/modules/orders/components/order-details/MediaSection';
import { OrderActions } from '@/modules/orders/components/order-details/OrderActions';
import { AdditionalInfoSection } from '@/modules/orders/components/order-details/AdditionalInfoSection';
import { AppIcon } from '@/shared/ui/AppIcon'

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
  const plotsQuery = usePlots();

  const plotCoordinates = useMemo(() => {
    if (!data || !plotsQuery.data) return null;

    const selectedPlot =
      (typeof data.plotId === 'number'
        ? plotsQuery.data.find((p) => p.id === data.plotId)
        : null) ??
      (data.plotName
        ? plotsQuery.data.find((p) => p.name === data.plotName)
        : null) ??
      plotsQuery.data.find((p) => p.name === data.place);

    const latitude = selectedPlot?.latitude;
    const longitude = selectedPlot?.longitude;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }

    return [latitude, longitude] as [number, number];
  }, [data, plotsQuery.data]);

  const destinationCoordinates = useMemo(() => {
    if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number') {
      return null;
    }

    return [data.latitude, data.longitude] as [number, number];
  }, [data]);

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
        <button
          onClick={() => navigate(-1)}
          className={styles.backButton}
        >
          <span className={styles.backIcon}>
            <AppIcon name="arrowLeft" />
          </span>
          Назад
        </button>
      </div>
    );
  }

  // Not found
  if (!data) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.error}>Заказ не найден</div>
        <button
          onClick={() => navigate(-1)}
          className={styles.backButton}
        >
          <span className={styles.backIcon}>
            <AppIcon name="arrowLeft" />
          </span>
          Назад
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
        type={(data.monumentType as string) ?? ''}
        size={(data.monumentSize as string) ?? ''}
      />

      <MetadataSection
        manager={data.managerFullName}
        orderDate={data.orderDate}
        createdAt={data.createdAt}
        updatedAt={data.updatedAt}
        dateOnly
      />

      <InstallationSection
        plotName={data.plotName}
        place={data.place}
        inspectionPlace={data.inspectionPlace}
        latitude={data.latitude}
        longitude={data.longitude}
        distanceKm={
          data.workItems.find(
            w => w.workDescription === 'Расстояние'
          )?.quantity ?? null
        }
        plotCoordinates={plotCoordinates}
        destinationCoordinates={destinationCoordinates}
      />

      <WorksSection items={data.workItems} />

      <FinancialSection
        subtotal={data.subtotal}
        discountPercent={data.discountPercent}
        discountAmount={data.discountAmount}
        totalPrice={data.totalPrice}
        payments={data.payments}
        paymentStatus={
          typeof data.paymentStatus === 'number'
            ? data.paymentStatus
            : Number(data.paymentStatus) || 0
        }
      />

      <PaymentsSection items={data.payments} />

      <MediaSection items={data.photos} />

      <AdditionalInfoSection
        additionalInfo={(data.additionalInfo as string) ?? ''}
      />
      <OrderActions orderId={data.id} />
    </div>
  );
}
