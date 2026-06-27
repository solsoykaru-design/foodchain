import { useEffect, useRef } from 'react';

type WsHandler = (data: any) => void;

function getWsUrl(): string {
  const stored = localStorage.getItem('foodchain_api_url');
  if (stored && stored.trim()) {
    return stored.replace(/^http/, 'ws');
  }
  // Same-origin: use current page's origin
  const loc = window.location;
  const wsProtocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${loc.host}`;
}

export function useWaiterSocket(handlers: Record<string, WsHandler>) {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const wsUrl = getWsUrl();
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
