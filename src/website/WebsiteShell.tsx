import { useState, useEffect } from 'react';
import WebsiteApp from './WebsiteApp';

export default function WebsiteShell() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const base = localStorage.getItem('foodchain_api_url') || 'http://localhost:4000';
    const tenantId = localStorage.getItem('foodchain_website_tenant');
    if (!tenantId) {
      localStorage.setItem('foodchain_website_tenant', '1');
    }
    document.documentElement.lang = 'ru';
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-orange-500 font-semibold">Загрузка...</div>
      </div>
    );
  }

  return <WebsiteApp />;
}
