import { API_URL } from '../constants/config';

let baseUrl = API_URL;

export function setBaseUrl(url: string) {
  baseUrl = url;
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { const j = JSON.parse(text); msg = j.error || j.message || text; } catch {}
    throw new Error(msg.slice(0, 300));
  }
  return res.json();
}

export async function aiGenerateTechCard(dishName: string) {
  return request('/api/tech-cards/ai-generate', {
    method: 'POST',
    body: JSON.stringify({ dish_name: dishName }),
  });
}

export async function aiSaveTechCard(data: any) {
  return request('/api/tech-cards/ai-save', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
