'use client';

import React, { useEffect, useRef } from 'react';
import { DayItinerary } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { getDayColorTheme } from '@/lib/constants';
import ScheduledCard from './ScheduledCard';
import { validateScheduledPlace } from '@/lib/routeOptimizer';
import {
  Sparkles,
  Calendar,
  AlertTriangle,
  FileText,
  Trash2,
  MapPin,
  Coffee,
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface DayColumnProps {
  itinerary: DayItinerary;
}

export default function DayColumn({ itinerary }: DayColumnProps) {
  const {
    places,
    scheduledPlaces,
    optimizeDayRoute,
    addBreakToDay,
    updateDayNotes,
    removeDay,
    updateDayDate,
    dayCount,
    activeDayIndex,
    setActiveDayIndex,
  } = useAppStore();

  const { setNodeRef, isOver } = useDroppable({
    id: `day-column-${itinerary.dayIndex}`,
    data: { dayIndex: itinerary.dayIndex, type: 'DAY_COLUMN' },
  });

  const theme = getDayColorTheme(itinerary.dayIndex);
  const isActive = activeDayIndex === itinerary.dayIndex;
  const isHighlightedDrop = isOver;

  const columnRef = useRef<HTMLDivElement | null>(null);

  // Jump to this day's column when it becomes the selected day - e.g. clicking "2일차"
  // while looking at day 3 used to just highlight day 2's border, leaving the user to
  // scroll there manually.
  useEffect(() => {
    if (isActive && columnRef.current) {
      columnRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [isActive]);

  // Scheduled items for this specific day, sorted by order
  const daySchedules = scheduledPlaces
    .filter((s) => s.dayIndex === itinerary.dayIndex)
    .sort((a, b) => a.order - b.order);

  const breakCount = daySchedules.filter((s) => s.type === 'BREAK').length;
  const placeCount = daySchedules.length - breakCount;

  // Check for any validation warnings in this day using exact dateStr
  const dayOffWarnings = daySchedules.filter((s) => {
    const p = places.find((place) => place.id === s.placeId);
    if (!p) return false;
    const issues = validateScheduledPlace(p, itinerary.weekday, itinerary.dateStr);
    return issues.some((i) => i.type === 'DAY_OFF');
  });

  // NOTE: this column used to ALSO carry native HTML5 drop handlers that called
  // addPlaceToDay. PlaceCard was simultaneously a dnd-kit draggable and a native
  // draggable, so one drag fired BOTH the dnd-kit onDragEnd in app/page.tsx and this
  // native onDrop — appending the same place twice. dnd-kit is now the single source
  // of drag-and-drop; its useDroppable above provides the drop target and highlight.

  return (
    <div
      ref={columnRef}
      onClick={() => setActiveDayIndex(itinerary.dayIndex)}
      className={`w-full md:w-80 flex-shrink-0 bg-white rounded-2xl border flex flex-col h-auto md:h-full overflow-hidden transition-all shadow-md ${
        isHighlightedDrop
          ? 'border-emerald-500 ring-4 ring-emerald-500/30 bg-emerald-50/20 scale-[1.01]'
          : isActive
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Column Header */}
      <div
        className="p-3.5 border-b border-slate-200 flex flex-col gap-2 relative bg-white shrink-0"
        style={{
          borderTop: `4px solid ${theme.color}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded-full text-white text-xs font-black shadow-xs"
              style={{ backgroundColor: theme.color }}
            >
              {itinerary.title}
            </span>

            {/* DatePicker & Weekday Display: 1일차 (2026-08-04 화요일) */}
            <div className="relative flex items-center gap-1 bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-200 hover:border-emerald-500/50 transition-colors">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <input
                type="date"
                value={itinerary.dateStr}
                onChange={(e) => {
                  if (e.target.value) {
                    updateDayDate(itinerary.dayIndex, e.target.value);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent text-[11px] font-extrabold text-slate-900 focus:outline-none cursor-pointer w-24"
              />
              <span className="text-[11px] font-bold text-slate-500">({itinerary.weekdayLabel})</span>
            </div>
          </div>

          {dayCount > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeDay(itinerary.dayIndex);
              }}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="이 일차 삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Warning Indicator Badge if day has휴무일 conflict */}
        {dayOffWarnings.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>휴무일 경고 {dayOffWarnings.length}건 발생 ({itinerary.weekdayLabel} 휴무)</span>
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">
            {placeCount}개 장소{breakCount > 0 ? ` · ${breakCount}개 휴식` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addBreakToDay(itinerary.dayIndex);
            }}
            className="flex items-center gap-1 text-[11px] font-extrabold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 transition-all shadow-2xs"
          >
            <Coffee className="w-3 h-3 text-amber-600" />
            <span>휴식시간 추가</span>
          </button>

          {daySchedules.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                optimizeDayRoute(itinerary.dayIndex);
              }}
              className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 transition-all shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>최단 동선 정렬</span>
            </button>
          )}
        </div>
      </div>

      {/* Scheduled Card List Area - Droppable & Sortable */}
      <div
        ref={setNodeRef}
        className={`flex-1 md:overflow-y-auto p-3 space-y-2.5 min-h-[160px] touch-pan-y transition-colors ${
          isHighlightedDrop ? 'bg-emerald-50/60 ring-2 ring-emerald-500/40' : 'bg-slate-50/40'
        }`}
      >
        <SortableContext
          items={daySchedules.map((s) => s.scheduleId)}
          strategy={verticalListSortingStrategy}
        >
          {daySchedules.length === 0 ? (
            <div className="h-full min-h-[180px] border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-4 text-center bg-white">
              <MapPin className="w-6 h-6 text-slate-400 mb-2" />
              <p className="text-xs text-slate-600 font-semibold">
                등록된 일정 장소가 없습니다.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                왼쪽 장소 카드를 드래그하여 여기에 놓으세요.
              </p>
            </div>
          ) : (
            daySchedules.map((schedule, index) => (
              <ScheduledCard
                key={schedule.scheduleId}
                scheduledPlace={schedule}
                orderIndex={index}
                totalInDay={daySchedules.length}
                nextScheduledPlace={daySchedules[index + 1]}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Footer Notes Area */}
      <div className="p-3 bg-white border-t border-slate-200">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1.5">
          <FileText className="w-3 h-3 text-slate-400" />
          <span>{itinerary.title} 일자 메모</span>
        </div>
        <textarea
          value={itinerary.notes}
          onChange={(e) => updateDayNotes(itinerary.dayIndex, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="예: 09:30 랜트카 수령, 18:00 숙소 입실 등..."
          rows={2}
          className="w-full bg-slate-50 text-xs text-slate-900 placeholder-slate-400 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 resize-none font-medium"
        />
      </div>
    </div>
  );
}
