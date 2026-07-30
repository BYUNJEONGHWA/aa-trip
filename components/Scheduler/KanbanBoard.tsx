'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import DayColumn from './DayColumn';
import { Plus } from 'lucide-react';

export default function KanbanBoard() {
  const { dayItineraries, addDay } = useAppStore();

  return (
    <div className="h-full w-full overflow-x-auto overflow-y-hidden p-4 flex gap-4 items-start select-none bg-slate-100/50 pb-6 border-b border-slate-200">
      {dayItineraries.map((itinerary) => (
        <DayColumn key={itinerary.dayIndex} itinerary={itinerary} />
      ))}

      {/* Add Day Card */}
      <button
        onClick={addDay}
        className="w-48 h-32 shrink-0 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50/50 transition-all cursor-pointer group shadow-xs"
      >
        <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center transition-all">
          <Plus className="w-5 h-5 text-slate-500 group-hover:text-emerald-600" />
        </div>
        <span className="text-xs font-bold">일차 추가하기</span>
      </button>
    </div>
  );
}
