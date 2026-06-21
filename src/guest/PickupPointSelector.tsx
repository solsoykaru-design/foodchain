import { useApp } from '../context';
import type { PickupPoint } from '../types';
import { MapPin, Check } from 'lucide-react';

export default function PickupPointSelector({ selectedId, onSelect }: { selectedId?: number; onSelect: (point: PickupPoint) => void }) {
  const { pickupPoints } = useApp();
  const active = pickupPoints.filter(p => p.isActive);

  return (
    <div className="space-y-2 mt-2">
      {active.map(point => (
        <div key={point.id} onClick={() => onSelect(point)} className={`rounded-xl border-2 p-3 cursor-pointer ${selectedId === point.id ? 'border-orange-500 bg-orange-50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm">{point.name}</h4>
            {selectedId === point.id && <Check size={18} className="text-orange-500"/>}
          </div>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1"><MapPin size={12}/> {point.address}</p>
        </div>
      ))}
    </div>
  );
}
