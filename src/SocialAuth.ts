import { registerPlugin } from '@capacitor/core';

export interface SocialLoginResult {
  email: string;
  name: string;
  id?: string;
}

export interface SocialAuthPlugin {
  loginWithGoogle(options: { webClientId: string }): Promise<SocialLoginResult>;
  loginWithVk(): Promise<SocialLoginResult>;
}

const isNative = !!(window as any).Capacitor?.isNativePlatform();

function showWebToast(message: string) {
  const el = document.createElement('div');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#1f2937', color: '#fff', padding: '10px 24px', borderRadius: '12px',
    fontSize: '14px', fontWeight: '600', zIndex: '9999', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    transition: 'opacity 0.3s', opacity: '0',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => el.style.opacity = '1');
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

const SocialAuth: SocialAuthPlugin = isNative
  ? registerPlugin<SocialAuthPlugin>('SocialAuth')
  : {
      async loginWithGoogle(_options: { webClientId: string }): Promise<SocialLoginResult> {
        throw new Error('SocialAuth доступен только в нативном приложении');
      },
      async loginWithVk(): Promise<SocialLoginResult> {
        throw new Error('SocialAuth доступен только в нативном приложении');
      },
    };

export default SocialAuth;
