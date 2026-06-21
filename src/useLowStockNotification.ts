import { useEffect } from 'react';
import type { Notification } from './types';

export function useLowStockNotification(addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void) {
  useEffect(() => {
    // Removed: fake data dependency. Real implementation would fetch from API.
  }, [addNotification]);
}
