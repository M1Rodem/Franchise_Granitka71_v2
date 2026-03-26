// temp-message.service.ts

export type TempMessageType = 'success' | 'error' | 'warning' | 'info';
export type TempMessagePosition = 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft' | 'topCenter' | 'bottomCenter';

export interface TempMessagePayload {
  type: TempMessageType;
  message: string;
  durationMs?: number;
  position?: TempMessagePosition;
  showProgress?: boolean;
  closable?: boolean;
}

export interface TempMessageOptions {
  durationMs?: number;
  position?: TempMessagePosition;
  showProgress?: boolean;
  closable?: boolean;
}

type TempMessageHandler = (payload: TempMessagePayload) => void;

let tempMessageHandler: TempMessageHandler | null = null;
let messageQueue: TempMessagePayload[] = [];
let isShowingQueue = false;

export function registerTempMessageHandler(handler: TempMessageHandler): () => void {
  tempMessageHandler = handler;
  
  // Показываем сообщения из очереди
  if (messageQueue.length > 0 && !isShowingQueue) {
    showNextFromQueue();
  }

  return () => {
    if (tempMessageHandler === handler) {
      tempMessageHandler = null;
    }
  };
}

function showNextFromQueue() {
  if (messageQueue.length === 0) {
    isShowingQueue = false;
    return;
  }
  
  isShowingQueue = true;
  const nextMessage = messageQueue.shift();
  
  if (nextMessage && tempMessageHandler) {
    tempMessageHandler(nextMessage);
    
    // После закрытия текущего сообщения показываем следующее
    setTimeout(() => {
      isShowingQueue = false;
      showNextFromQueue();
    }, nextMessage.durationMs ?? 2500);
  } else {
    isShowingQueue = false;
  }
}

/**
 * Показать временное сообщение
 */
export function showTempMessage(
  type: TempMessageType,
  message: string,
  options?: TempMessageOptions
): void;
export function showTempMessage(
  type: TempMessageType,
  message: string,
  durationMs?: number
): void;
export function showTempMessage(
  type: TempMessageType,
  message: string,
  durationMsOrOptions?: number | TempMessageOptions
): void {
  let options: TempMessageOptions = {};
  
  if (typeof durationMsOrOptions === 'number') {
    options = { durationMs: durationMsOrOptions };
  } else if (durationMsOrOptions) {
    options = durationMsOrOptions;
  }
  
  const payload: TempMessagePayload = {
    type,
    message,
    durationMs: options.durationMs ?? 2500,
    position: options.position ?? 'topRight',
    showProgress: options.showProgress ?? true,
    closable: options.closable ?? true,
  };
  
  if (tempMessageHandler) {
    tempMessageHandler(payload);
  } else {
    // Если обработчик еще не зарегистрирован, добавляем в очередь
    messageQueue.push(payload);
  }
}

/**
 * Быстрые методы для разных типов сообщений
 */
export const tempMessage = {
  success: (message: string, options?: TempMessageOptions) => 
    showTempMessage('success', message, options),
  
  error: (message: string, options?: TempMessageOptions) => 
    showTempMessage('error', message, options),
  
  warning: (message: string, options?: TempMessageOptions) => 
    showTempMessage('warning', message, options),
  
  info: (message: string, options?: TempMessageOptions) => 
    showTempMessage('info', message, options),
};

/**
 * Очистить очередь сообщений
 */
export function clearTempMessageQueue(): void {
  messageQueue = [];
  isShowingQueue = false;
}

/**
 * Проверить, есть ли активный обработчик
 */
export function hasTempMessageHandler(): boolean {
  return tempMessageHandler !== null;
}