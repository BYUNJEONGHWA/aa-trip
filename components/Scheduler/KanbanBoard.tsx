'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import DayColumn from './DayColumn';
import { Plus, Calendar, Layers } from 'lucide-react';

export default function KanbanBoard() {
  const { dayItineraries, addDay, activeDayIndex, setActiveDayIndex } = useAppStore();
  const [mobileViewMode, setMobileViewMode] = useState<'SINGLE' | 'STACKED'>('SINGLE');

  return (
    <div className="w-full h-auto md:h-full flex flex-col overflow-visible md:overflow-hidden select-none bg-slate-100/50">
      {/* Mobile Top Controls & Add Day Bar (< 768px) */}
      <div className="md:hidden bg-white border-b border-slate-200 p-3 space-y-2 shrink-0 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>여행 일정 ({dayItineraries.length}일차)</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Single Day vs Stacked All Days View */}
            <button
              onClick={() => setMobileViewMode(mobileViewMode === 'SINGLE' ? 'STACKED' : 'SINGLE')}
              className="px-2.5 py-1 text-[11px] font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1"
            >
              <Layers className="w-3 h-3 text-slate-500" />
              <span>{mobileViewMode === 'SINGLE' ? '전체 보기' : '일차별 보기'}</span>
            </button>

            {/* Prominent Add Day Button */}
            <button
              onClick={addDay}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
              title="새 일차(DAY) 추가"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>일차 추가</span>
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Day Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-0.5">
          {dayItineraries.map((it) => {
            const isActive = activeDayIndex === it.dayIndex;
            return (
              <button
                key={it.dayIndex}
                onClick={() => {
                  setActiveDayIndex(it.dayIndex);
                  if (mobileViewMode === 'STACKED') setMobileViewMode('SINGLE');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all border ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs scale-[1.02]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                }`}
              >
                {it.title} ({it.dateStr.slice(5)})
              </button>
            );
          })}

          <button
            onClick={addDay}
            className="px-3 py-1.5 rounded-xl text-xs font-black shrink-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ 일차 추가</span>
          </button>
        </div>
      </div>

      {/* Main Kanban Content Container */}
      {/* Mobile (< 768px): Vertical Stack or Selected Single Day with Full Page Scroll */}
      {/* Desktop (>= 768px): Side-by-Side Horizontal Scrollable Board */}
      <div className="w-full flex-1 md:overflow-x-auto md:overflow-y-hidden p-3 sm:p-4 flex flex-col md:flex-row gap-4 items-start pb-20 md:pb-6">
        {/* Mobile Single View mode */}
        <div className="md:hidden w-full space-y-4">
          {mobileViewMode === 'SINGLE' ? (
            dayItineraries
              .filter((it) => it.dayIndex === activeDayIndex)
              .map((itinerary) => (
                <DayColumn key={itinerary.dayIndex} itinerary={itinerary} />
              ))
          ) : (
            dayItineraries.map((itinerary) => (
              <DayColumn key={itinerary.dayIndex} itinerary={itinerary} />
            ))
          )}

          {/* Add Day Card on Mobile */}
          <button
            onClick={addDay}
            className="w-full py-4 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/60 transition-all cursor-pointer shadow-2xs font-black text-xs min-h-[52px]"
          >
            <Plus className="w-4 h-4 text-emerald-600 stroke-[3]" />
            <span>+ 새로운 일차 추가하기 (DAY {dayItineraries.length + 1})</span>
          </button>
        </div>

        {/* Desktop Side-by-Side View (>= 768px) */}
        <div className="hidden md:flex gap-4 items-start h-full w-full">
          {dayItineraries.map((itinerary) => (
            <DayColumn key={itinerary.dayIndex} itinerary={itinerary} />
          ))}

          {/* Add Day Card on Desktop */}
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
      </div>
    </div>
  );
}
