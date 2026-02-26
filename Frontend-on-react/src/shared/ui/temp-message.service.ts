export type TempMessageType = 'success' | 'error' | 'warning' | 'info';

export interface TempMessagePayload {
  type: TempMessageType;
  message: string;
  durationMs?: number;
}

type TempMessageHandler = (payload: TempMessagePayload) => void;

let tempMessageHandler: TempMessageHandler | null = null;

export function registerTempMessageHandler(handler: TempMessageHandler): () => void {
  tempMessageHandler = handler;

  return () => {
    if (tempMessageHandler === handler) {
      tempMessageHandler = null;
    }
  };
}

export function showTempMessage(type: TempMessageType, message: string, durationMs = 4000): void {
  tempMessageHandler?.({ type, message, durationMs });
}
