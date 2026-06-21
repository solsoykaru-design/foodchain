import { useEffect, useRef } from 'react';

type WsHandler = (data: any) => void;

const API_BASE = localStorage.getItem('foodchain_api_url') || 'http://localhost:4000';

export function useWaiterSocket(handlers: Record<string, WsHandler>) {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const wsUrl = API_BASE.replace(/^http/, 'ws');
        const ws = new WebSocket(wsUrl);
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            const handler = handlersRef.current?.[data.type];
            if (handler) handler(data);
          } catch { /* ignore parse errors */ }
        };
        ws.onclose = () => {
          timerRef.current = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
        wsRef.current = ws;
      } catch {
        timerRef.current = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return wsRef;
}
