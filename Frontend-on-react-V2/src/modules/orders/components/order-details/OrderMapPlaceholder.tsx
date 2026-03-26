import { OrderDetailMap } from './OrderDetailMap';
import styles from './order-map-placeholder.module.css';

interface Props {
  plotCoordinates: [number, number] | null;
  destinationCoordinates: [number, number] | null;
}

export function OrderMapPlaceholder({
  plotCoordinates,
  destinationCoordinates,
}: Props) {
  if (!plotCoordinates && !destinationCoordinates) {
    return null;
  }

  return (
    <div className={styles.placeholder}>
      <OrderDetailMap
        plotCoordinates={plotCoordinates}
        destinationCoordinates={destinationCoordinates}
      />
    </div>
  );
}