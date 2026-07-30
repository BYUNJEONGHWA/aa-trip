'use client';

import React, { useEffect, useRef } from 'react';
import { Place, ScheduledPlace } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { getDayColorTheme } from '@/lib/constants';
import { validateScheduledPlace, calculateDistanceKm, estimateTravelTimeMinutes } from '@/lib/routeOptimizer';
import { Trash2, AlertTriangle, Clock, Navigation, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ScheduledCardProps {
  scheduledPlace: ScheduledPlace;
  orderIndex: number;
  totalInDay: number;
  nextScheduledPlace?: ScheduledPlace;
}

export default function ScheduledCard({
  scheduledPlace,
  orderIndex,
  totalInDay,
  nextScheduledPlace,
}: ScheduledCardProps) {
  const {
    places,
    dayItineraries,
    removeScheduledPlace,
    selectedPlaceId,
    setSelectedPlaceId,
    setFocusPlaceLocation,
  } = useAppStore();
  const cardRef = useRef<HTMLDivElement | null>(null);

  const place = places.find((p) => p.id === scheduledPlace.placeId);
  const currentDayInfo = dayItineraries.find((it) => it.dayIndex === scheduledPlace.dayIndex);
  const theme = getDayColorTheme(scheduledPlace.dayIndex);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!place) return;
    setSelectedPlaceId(place.id);
    setFocusPlaceLocation({
      lat: place.lat,
      lng: place.lng,
      timestamp: Date.now(),
    });
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: scheduledPlace.scheduleId,
    data: { scheduledPlace, place, type: 'SCHEDULED_PLACE' },
  });

  const isSelected = selectedPlaceId === place?.id;

  // Auto-scroll scheduled place card into view when marker is clicked on map
  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isSelected]);

  if (!place || !currentDayInfo) return null;

  // Real-time Day-off validation check using exact calendar date (dateStr)
  const validationIssues = validateScheduledPlace(place, currentDayInfo.weekday, currentDayInfo.dateStr);
  const hasDayOffWarning = validationIssues.some((i) => i.type === 'DAY_OFF');

  // Calculate distance to next place if available
  let nextDistanceKm = 0;
  let nextTravelMinutes = 0;
  if (nextScheduledPlace) {
    const nextPlace = places.find((p) => p.id === nextScheduledPlace.placeId);
    if (nextPlace) {
      nextDistanceKm = calculateDistanceKm(place.lat, place.lng, nextPlace.lat, nextPlace.lng);
      nextTravelMinutes = estimateTravelTimeMinutes(nextDistanceKm);
    }
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={(node) => {
        cardRef.current = node;
        setNodeRef(node);
      }}
      style={style}
      className={`relative group flex flex-col gap-2 transition-all ${
        isDragging ? 'opacity-30 scale-95' : ''
      }`}
    >
      <div
        onClick={handleCardClick}
        className={`bg-white rounded-xl p-3 border cursor-pointer transition-all duration-200 ${
          isSelected
            ? 'ring-4 ring-emerald-500/50 border-emerald-500 bg-emerald-50/90 shadow-md scale-[1.01] z-10'
            : hasDayOffWarning
            ? 'border-rose-300 bg-rose-50/80 ring-2 ring-rose-400/20 shadow-xs'
            : 'border-slate-200 hover:border-slate-300 shadow-xs'
        }`}
      >
        {/* Card Header: Grip + Order Badge + Name + Remove */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Grip Handle */}
            <div
              {...listeners}
              {...attributes}
              className="cursor-grab active:cursor-grabbing p-0.5 text-slate-300 hover:text-slate-600 rounded shrink-0 transition-colors"
              title="드래그해서 순서/일차 변경"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            {/* Custom Day Color Sequence Badge */}
            <span
              className="w-5 h-5 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-xs"
              style={{ backgroundColor: theme.color }}
            >
              {orderIndex + 1}
            </span>

            <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
              {place.name}
            </h4>
          </div>

          <button
            onClick={() => removeScheduledPlace(scheduledPlace.scheduleId)}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
            title="일정에서 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Operating Hours & Category info */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 pl-5">
          <span className="truncate max-w-[100px] font-medium text-slate-400">{place.category}</span>
          <div className="flex items-center gap-1 text-slate-600 font-medium">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{place.operatingHours.open} ~ {place.operatingHours.close}</span>
          </div>
        </div>

        {/* Break time or Last order if present */}
        {(place.operatingHours.breakTime || place.operatingHours.lastOrder) && (
          <div className="mt-1 pl-5 flex items-center gap-1.5 text-[10px] flex-wrap">
            {place.operatingHours.breakTime && (
              <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                ☕ 브레이크: {place.operatingHours.breakTime}
              </span>
            )}
            {place.operatingHours.lastOrder && (
              <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                🍽️ L.O: {place.operatingHours.lastOrder}
              </span>
            )}
          </div>
        )}

        {/* Day-Off Alert Warning Banner if scheduled on Day Off */}
        {hasDayOffWarning && (
          <div className="mt-2.5 p-2 bg-rose-100/70 border border-rose-300 rounded-lg flex items-start gap-1.5 text-[11px] text-rose-800 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p>⚠️ {currentDayInfo.dateStr} ({currentDayInfo.weekdayLabel}) 정기 휴무일입니다!</p>
              <p className="text-[10px] text-rose-600/90 font-medium mt-0.5">
                {place.holiday_text || place.dayOffRaw || '휴무 일정 확인 필요'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Travel Time/Distance to Next Place Connector */}
      {nextScheduledPlace && nextDistanceKm > 0 && (
        <div className="flex items-center justify-center my-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full border border-slate-200 text-[10px] font-semibold text-slate-600 shadow-2xs">
            <Navigation className="w-3 h-3 text-emerald-600" />
            <span>다음 장소까지:</span>
            <span className="text-blue-600 font-bold">{nextDistanceKm}km</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-600 font-bold">약 {nextTravelMinutes}분</span>
          </div>
        </div>
      )}
    </div>
  );
}
