import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Search, Barcode } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('manual');
  const [manualInput, setManualInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setMode('camera');

      // Try using BarcodeDetector API
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'code_39', 'upc_a', 'upc_e'] });
        const detect = async () => {
          if (!videoRef.current || streamRef.current === null) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              stopCamera();
              onScan(code);
              return;
            }
          } catch {}
          requestAnimationFrame(detect);
        };
        detect();
      }
    } catch (e) {
      console.warn('Camera error:', e);
      setMode('manual');
    }
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-zinc-900 dark:text-white">Сканер штрихкода</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={18} /></button>
        </div>

        {mode === 'camera' ? (
          <div className="relative bg-black rounded-xl overflow-hidden mb-3">
            <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover" />
            <div className="absolute inset-0 border-2 border-indigo-400/50 rounded-xl flex items-center justify-center">
              <div className="w-3/4 h-0.5 bg-indigo-400/70 animate-pulse" />
            </div>
            <button onClick={() => { stopCamera(); setMode('manual'); }} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-lg text-xs">Отмена</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Введите штрихкод вручную или используйте камеру</p>
            <div className="flex gap-2">
              <input value={manualInput} onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Штрихкод" autoFocus
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={handleManualSubmit} className="bg-indigo-500 text-white px-3 py-2.5 rounded-xl"><Search size={18} /></button>
            </div>
            <button onClick={startCamera} className="w-full flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700">
              <Camera size={16} /> Открыть камеру
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
