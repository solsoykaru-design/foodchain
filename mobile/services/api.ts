import { API_URL } from '../constants/config';

let baseUrl = API_URL;
let authToken: string | null = null;

export function setBaseUrl(url: string) {
  baseUrl = url;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { const j = JSON.parse(text); msg = j.error || j.message || text; } catch {}
    throw new Error(msg.slice(0, 300));
  }
  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};

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
