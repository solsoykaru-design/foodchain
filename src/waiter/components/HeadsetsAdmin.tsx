import { useState, useEffect } from 'react';
import { Headset, Plus, Trash2, Link, Unlink, Save, User, X } from 'lucide-react';
import * as api from '../../api';

interface Headset {
  id: number;
  deviceMac: string;
  deviceName: string;
  waiterId: number | null;
  waiterNick: string | null;
  isActive: number;
  lastConnectedAt: string | null;
  staffName?: string;
}

interface Staff {
  id: number;
  name: string;
  role: string;
}

interface Props {
  onClose: () => void;
}

export default function HeadsetsAdmin({ onClose }: Props) {
  const [headsets, setHeadsets] = useState<Headset[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMac, setNewMac] = useState('');
  const [newName, setNewName] = useState('');
  const [newWaiterId, setNewWaiterId] = useState<number | ''>('');
  const [newWaiterNick, setNewWaiterNick] = useState('');

  const loadHeadsets = async () => {
    try {
      const data = await api.request('/api/voice/headsets');
      setHeadsets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load headsets error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      const data = await api.request('/api/staff');
      setStaff(Array.isArray(data) ? data.filter((s: any) => s.role === 'waiter') : []);
    } catch (e) {
      console.error('Load staff error:', e);
    }
  };

  useEffect(() => {
    loadHeadsets();
    loadStaff();
  }, []);

  const addHeadset = async () => {
    if (!newMac || !newWaiterId) return;
    
    try {
      await api.request('/api/voice/headsets', {
        method: 'POST',
        body: JSON.stringify({
          deviceMac: newMac,
          deviceName: newName || 'Unknown Device',
          waiterId: Number(newWaiterId),
          waiterNick: newWaiterNick || staff.find(s => s.id === Number(newWaiterId))?.name || 'Официант',
        }),
      });
      
      setNewMac('');
      setNewName('');
      setNewWaiterId('');
      setNewWaiterNick('');
      setShowAddForm(false);
      loadHeadsets();
    } catch (e) {
      console.error('Add headset error:', e);
    }
  };

  const unbindHeadset = async (mac: string) => {
    if (!confirm('Отвязать гарнитуру от официанта?')) return;
    
    try {
      await api.request(`/api/voice/headsets/${encodeURIComponent(mac)}`, {
        method: 'DELETE',
      });
      loadHeadsets();
    } catch (e) {
      console.error('Unbind headset error:', e);
    }
  };

  const removeHeadset = async (mac: string) => {
    if (!confirm('Удалить гарнитуру?')) return;
    
    try {
      await api.request(`/api/voice/headsets/${encodeURIComponent(mac)}/remove`, {
        method: 'DELETE',
      });
      loadHeadsets();
    } catch (e) {
      console.error('Remove headset error:', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Headset className="w-6 h-6 text-orange-500" />
              Bluetooth-гарнитуры
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Привязка гарнитур к официантам</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600"
          >
            <Plus className="w-4 h-4" />
            Добавить гарнитуру
          </button>

          {showAddForm && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-white">Новая гарнитура</h3>
              
              <div className="space-y-2">
                <input
                  type="text"
                  value={newMac}
                  onChange={e => setNewMac(e.target.value)}
                  placeholder="MAC-адрес (AA:BB:CC:DD:EE:FF)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-white text-sm placeholder-zinc-600 focus:border-orange-500 outline-none"
                />
                
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Название устройства (опционально)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-white text-sm placeholder-zinc-600 focus:border-orange-500 outline-none"
                />
                
                <select
                  value={newWaiterId}
                  onChange={e => setNewWaiterId(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-500 outline-none"
                >
                  <option value="">Выберите официанта</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                
                <input
                  type="text"
                  value={newWaiterNick}
                  onChange={e => setNewWaiterNick(e.target.value)}
                  placeholder="Ник (опционально)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-white text-sm placeholder-zinc-600 focus:border-orange-500 outline-none"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={addHeadset}
                  disabled={!newMac || !newWaiterId}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 disabled:opacity-40 text-sm"
                >
                  <Save className="w-4 h-4" />
                  Сохранить
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-zinc-700 text-zinc-300 font-medium rounded-xl hover:bg-zinc-600 text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : headsets.length === 0 ? (
            <div className="text-center py-12 bg-zinc-800/30 rounded-xl">
              <Headset className="w-12 h-12 mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm">Нет привязанных гарнитур</p>
            </div>
          ) : (
            <div className="space-y-2">
              {headsets.map(headset => (
                <div
                  key={headset.id}
                  className={`bg-zinc-800/50 border rounded-xl p-4 ${
                    headset.waiterId ? 'border-green-500/30' : 'border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        headset.waiterId ? 'bg-green-900/30' : 'bg-zinc-700'
                      }`}>
                        <Headset className={`w-5 h-5 ${headset.waiterId ? 'text-green-400' : 'text-zinc-500'}`} />
                      </div>
                      <div>
                        <p className="font-mono text-xs text-white">{headset.deviceMac}</p>
                        <p className="text-xs text-zinc-500">{headset.deviceName}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      {headset.waiterId && (
                        <button
                          onClick={() => unbindHeadset(headset.deviceMac)}
                          className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-yellow-400"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeHeadset(headset.deviceMac)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {headset.waiterId ? (
                    <div className="flex items-center gap-2 bg-green-900/20 rounded-lg px-3 py-2">
                      <User className="w-4 h-4 text-green-400" />
                      <div>
                        <p className="text-xs font-medium text-green-400">
                          {headset.waiterNick || headset.staffName || `Официант #${headset.waiterId}`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-zinc-700/50 rounded-lg px-3 py-2">
                      <Link className="w-4 h-4 text-zinc-500" />
                      <p className="text-xs text-zinc-500">Не привязана</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
