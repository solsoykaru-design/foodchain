import { useState } from 'react';
import { useApp } from '../context';
import { MapPin, Plus, X, Check, ChevronUp, ChevronDown, Star } from 'lucide-react';

export default function PickupPointsPage() {
  const { pickupPoints, addPickupPoint, updatePickupPoint, deletePickupPoint, reorderPickupPoint, togglePickupPointActive } = useApp();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '', description: '', estimatedReadyMinutes: 18, lat: 55.75, lng: 37.60 });

  const handleSave = () => {
    if (form.name && form.address) {
      addPickupPoint({
        id: Date.now(), ...form, rating: 0, reviewCount: 0, isActive: true, displayOrder: pickupPoints.length + 1,
        photos: [], workingHours: { mon: { open: '10:00', close: '22:00' }, tue: { open: '10:00', close: '22:00' }, wed: { open: '10:00', close: '22:00' }, thu: { open: '10:00', close: '22:00' }, fri: { open: '10:00', close: '22:00' }, sat: { open: '10:00', close: '22:00' }, sun: { open: '10:00', close: '22:00' } },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      setShowForm(false);
      setForm({ name: '', address: '', phone: '', description: '', estimatedReadyMinutes: 18, lat: 55.75, lng: 37.60 });
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Точки самовывоза</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 active:scale-[0.97] transition-transform"><Plus size={16}/> Добавить</button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3 border border-blue-200 dark:border-blue-800">
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Название" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Адрес" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Телефон" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Описание" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" rows={2} />
          <button onClick={handleSave} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-[0.97] transition-transform">Сохранить</button>
        </div>
      )}

      <div className="space-y-2">
        {[...pickupPoints].sort((a, b) => a.displayOrder - b.displayOrder).map(point => (
          <div key={point.id} className={`bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border ${point.isActive ? 'border-zinc-100 dark:border-zinc-800' : 'border-red-200 dark:border-red-900/50 opacity-70'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-zinc-900 dark:text-white">{point.name}</h3>
                  {point.rating > 0 && <span className="text-xs text-amber-500 flex items-center gap-0.5"><Star size={12} fill="#f59e0b"/> {point.rating}</span>}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 flex items-center gap-1 mt-1"><MapPin size={12}/> {point.address}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-300 mt-0.5">⏱ {point.estimatedReadyMinutes} мин • {point.phone}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => togglePickupPointActive(point.id)} className={`p-1.5 rounded-lg active:scale-[0.97] transition-transform ${point.isActive ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-zinc-300 dark:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                  {point.isActive ? <Check size={16}/> : <X size={16}/>}
                </button>
                <button onClick={() => reorderPickupPoint(point.id, 'up')} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.97] transition-transform"><ChevronUp size={16}/></button>
                <button onClick={() => reorderPickupPoint(point.id, 'down')} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.97] transition-transform"><ChevronDown size={16}/></button>
                <button onClick={() => deletePickupPoint(point.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.97] transition-transform"><X size={16}/></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
