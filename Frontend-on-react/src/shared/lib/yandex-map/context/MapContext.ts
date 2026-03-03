import { createContext, useContext } from 'react';

interface MapContextValue {
  map: any | null;
}

export const MapContext = createContext<MapContextValue>({
  map: null,
});

export const useMapContext = () => useContext(MapContext);