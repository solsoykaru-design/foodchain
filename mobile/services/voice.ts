import { Platform } from 'react-native';

type VoiceCallback = {
  onResult: (text: string) => void;
  onError: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
};

// Try expo-speech-recognition first (recommended)
let ExpoSpeechRecognition: any = null;
try { ExpoSpeechRecognition = require('expo-speech-recognition'); } catch {}

// Fallback to @react-native-voice/voice
let Voice: any = null;
try { Voice = require('@react-native-voice/voice').default || require('@react-native-voice/voice'); } catch {}

export async function startVoiceRecognition(callbacks: VoiceCallback) {
  // Try expo-speech-recognition
  if (ExpoSpeechRecognition?.startSpeechRecognition) {
    try {
      const { available } = await ExpoSpeechRecognition.requestPermissionsAsync();
      if (!available) throw new Error('Нет разрешения на микрофон');

      ExpoSpeechRecognition.addEventListener('speechrecognition', (event: any) => {
        if (event.type === 'result' && event.transcript) {
          callbacks.onResult(event.transcript);
        }
        if (event.type === 'error') {
          callbacks.onError(event.error || 'Ошибка распознавания');
        }
        if (event.type === 'start') callbacks.onStart?.();
        if (event.type === 'end') callbacks.onEnd?.();
      });

      await ExpoSpeechRecognition.startSpeechRecognition({ lang: 'ru-RU' });
      return;
    } catch (e: any) {
      // Fall through to next method
      console.log('expo-speech-recognition failed:', e.message);
    }
  }

  // Try @react-native-voice/voice
  if (Voice) {
    try {
      Voice.onSpeechResults = (e: any) => {
        if (e.value?.[0]) callbacks.onResult(e.value[0]);
      };
      Voice.onSpeechError = (e: any) => {
        callbacks.onError(e.error?.message || 'Ошибка распознавания');
      };
      Voice.onSpeechStart = () => callbacks.onStart?.();
      Voice.onSpeechEnd = () => callbacks.onEnd?.();

      await Voice.start('ru-RU');
      return;
    } catch (e: any) {
      console.log('@react-native-voice/voice failed:', e.message);
    }
  }

  // Web Speech API fallback
  if (Platform.OS === 'web') {
    startWebSpeech(callbacks);
    return;
  }

  // No speech recognition available
  callbacks.onError('Распознавание речи недоступно на этом устройстве');
}

export async function stopVoiceRecognition() {
  if (ExpoSpeechRecognition?.stopSpeechRecognition) {
    try { await ExpoSpeechRecognition.stopSpeechRecognition(); } catch {}
  }
  if (Voice) {
    try { await Voice.stop(); await Voice.destroy(); } catch {}
  }
  stopWebSpeech();
}

// Web Speech API
let webRecognition: any = null;

function startWebSpeech(callbacks: VoiceCallback) {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    callbacks.onError('Распознавание речи не поддерживается');
    return;
  }
  webRecognition = new SpeechRecognition();
  webRecognition.lang = 'ru-RU';
  webRecognition.continuous = false;
  webRecognition.interimResults = false;
  webRecognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript;
    callbacks.onResult(text);
  };
  webRecognition.onerror = (event: any) => {
    callbacks.onError(event.error || 'Ошибка распознавания');
  };
  webRecognition.onstart = () => callbacks.onStart?.();
  webRecognition.onend = () => callbacks.onEnd?.();
  webRecognition.start();
}

function stopWebSpeech() {
  if (webRecognition) {
    try { webRecognition.stop(); } catch {}
    webRecognition = null;
  }
}

export function parseVoiceToTechCard(text: string): {
  dish_name: string;
  ingredients: { name: string; quantity: number; unit: string }[];
} {
  const parts = text.split(/[,.\n]+/).map(s => s.trim()).filter(Boolean);
  const dishName = parts[0] || 'Блюдо';
  const ingredients: { name: string; quantity: number; unit: string }[] = [];

  const ingredientParts = parts.slice(1).filter(p => /\d+/.test(p));

  for (const part of ingredientParts) {
    const match = part.match(/^([а-яА-Яa-zA-Z\s\-]+?)\s+(\d+[.,]?\d*)\s*(грамм|гр?|г\.?|кг\.?|миллилитр|мл\.?|литр|л\.?|штук|шт\.?|шт)?/i);
    if (match) {
      const name = match[1].trim();
      const qty = parseFloat(match[2].replace(',', '.'));
      let unit = (match[3]?.toLowerCase() || 'г').replace(/\.$/, '');
      if (/кг/.test(unit)) unit = 'кг';
      else if (/мл|миллилитр/.test(unit)) unit = 'мл';
      else if (/л|литр/.test(unit)) unit = 'л';
      else if (/шт|штук/.test(unit)) unit = 'шт';
      else unit = 'г';
      if (name && qty > 0) ingredients.push({ name, quantity: qty, unit });
    }
  }

  return { dish_name: dishName, ingredients };
}
