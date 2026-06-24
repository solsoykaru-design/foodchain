import { API_URL } from '../constants/config';

let apiKey = '';

export function setApiKey(key: string) {
  apiKey = key;
}

export function getApiKey() {
  return apiKey;
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey; // assuming your backend checks this header
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200));
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

export async function testConnection() {
  return request('/api/health');
}
