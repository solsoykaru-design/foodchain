import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Smartphone, QrCode, Key, Trash2, X, AlertTriangle } from 'lucide-react';
import * as api from '../api';

export default function SecurityPage() {
  const [user, setUser] = useState<any>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [disableError, setDisableError] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('foodchain_admin_user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUser(u);
        fetchStatus(u.id);
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchStatus = async (staffId: number) => {
    try {
      const status = await api.get2FAStatus(staffId);
      setEnabled(status.enabled);
    } catch {}
    setLoading(false);
  };

  const handleSetup = async () => {
    if (!user) return;
    setSetupError('');
    setSetupSuccess(false);
    try {
      const data = await api.setup2FA(user.id);
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setShowSetup(true);
    } catch (e: any) {
      setSetupError(e.message || 'Ошибка настройки');
    }
  };

  const handleVerify = async () => {
    if (!user || token.length < 6) return;
    setSetupError('');
    try {
      await api.verify2FA(user.id, token);
      setSetupSuccess(true);
      setEnabled(true);
      setTimeout(() => {
        setShowSetup(false);
        setQrCode('');
        setSecret('');
        setToken('');
      }, 1500);
    } catch (e: any) {
      setSetupError(e.message || 'Неверный код');
    }
  };

  const handleDisable = async () => {
    if (!user) return;
    setDisableError('');
    try {
      if (disablePassword && user.username) {
        await api.changePassword(disablePassword, disablePassword, user.username);
      }
      await api.disable2FA(user.id);
      setEnabled(false);
      setShowDisable(false);
      setDisablePassword('');
      setDisableToken('');
    } catch (e: any) {
      setDisableError(e.message || 'Ошибка отключения');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Shield size={28} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Безопасность</h1>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              {enabled ? <ShieldCheck size={24} className="text-green-600" /> : <Smartphone size={24} className="text-zinc-400" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Двухфакторная аутентификация</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {enabled
                  ? 'Двухфакторная аутентификация активна. При входе в систему потребуется код из приложения.'
                  : 'Защитите свою учётную запись с помощью двухфакторной аутентификации.'}
              </p>
              <div className="mt-3">
                {enabled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Активна
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-sm font-medium rounded-full">
                    <span className="w-2 h-2 bg-zinc-400 rounded-full" />
                    Не активна
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!enabled ? (
              <button onClick={handleSetup} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors">
                <QrCode size={16} />
                Включить 2FA
              </button>
            ) : (
              <button onClick={() => setShowDisable(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl transition-colors">
                <Trash2 size={16} />
                Отключить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Setup QR Modal */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Настройка 2FA</h3>
              <button onClick={() => { setShowSetup(false); setQrCode(''); setSecret(''); setToken(''); }} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X size={20} />
              </button>
            </div>

            {setupSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck size={32} className="text-green-600" />
                </div>
                <p className="text-green-600 font-bold text-lg">2FA включена</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 text-center">
                  Отсканируйте QR-код в приложении аутентификатора (Google Authenticator, Яндекс Ключ и т.д.)
                </p>
                <div className="flex justify-center mb-4">
                  <img src={qrCode} alt="QR Code" className="w-48 h-48 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl" />
                </div>
                <div className="text-center mb-4">
                  <p className="text-xs text-zinc-400 mb-1">Или введите секретный ключ вручную:</p>
                  <code className="text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 font-mono select-all">{secret}</code>
                </div>
                <div className="space-y-3">
                  <input type="text" value={token} onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6}
                    className="w-full text-center text-2xl tracking-[0.5em] font-bold border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                  {setupError && <p className="text-red-500 text-sm text-center">{setupError}</p>}
                  <button onClick={handleVerify} disabled={token.length < 6} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition-colors">
                    Подтвердить
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Disable confirmation dialog */}
      {showDisable && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Отключение 2FA</h3>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Вы уверены, что хотите отключить двухфакторную аутентификацию? Ваша учётная запись будет защищена только паролем.
            </p>
            <div className="space-y-3">
              <div className="relative">
                <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} placeholder="Текущий пароль" className="w-full pl-9 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <input type="text" value={disableToken} onChange={e => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Код 2FA" maxLength={6}
                className="w-full text-center text-lg tracking-[0.4em] font-bold border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all" />
              {disableError && <p className="text-red-500 text-sm text-center">{disableError}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowDisable(false); setDisablePassword(''); setDisableToken(''); setDisableError(''); }} className="flex-1 px-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  Отмена
                </button>
                <button onClick={handleDisable} className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-colors">
                  Отключить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
