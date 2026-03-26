export type Coordinates = [number, number];

export interface RouteOptions {
  from: Coordinates;
  to: Coordinates;
}

export interface MapViewProps {
  center: Coordinates;
  zoom?: number;
  marker?: Coordinates | null;
  route?: RouteOptions;
  readOnly?: boolean;
  onSelect?: (coords: Coordinates) => void;
}