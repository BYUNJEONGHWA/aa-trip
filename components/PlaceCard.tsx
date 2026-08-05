'use client';

import React, { useEffect, useRef } from 'react';
import { Place } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { Clock, Calendar, Car, Plus, Star, MapPin, GripVertical, Trash2, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { WEEKDAY_KOREAN } from '@/lib/constants';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface PlaceCardProps {
  place: Place;
  isDragOverlay?: boolean;
}

export default function PlaceCard({ place, isDragOverlay }: PlaceCardProps) {
  const {
    activeDayIndex,
    addPlaceToDay,
    removePlace,
    scheduledPlaces,
    selectedPlaceId,
    setSelectedPlaceId,
    setFocusPlaceLocation,
    candidateSelectionIds,
    toggleCandidateSelection,
  } = useAppStore();
  const cardRef = useRef<HTMLDivElement | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-place-${place.id}`,
    data: { place, type: 'SIDEBAR_PLACE' },
  });

  const isSelected = selectedPlaceId === place.id;
  const isCandidateSelected = candidateSelectionIds.includes(place.id);

  // place.id is formatted like "naver_place_{sid}" or "naver_place_{sid}_{n}" -
  // strip the prefix/suffix to recover the numeric sid Naver Map uses in its own URLs.
  const naverMapUrl = `https://map.naver.com/p/entry/place/${place.id.replace(/^[^\d]+/, '').replace(/_\d+$/, '')}`;

  const handleCardClick = () => {
    setSelectedPlaceId(place.id);
    setFocusPlaceLocation({ lat: place.lat, lng: place.lng, timestamp: Date.now() });
  };

  // Auto-scroll sidebar to this place card when marker is clicked on map
  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isSelected]);

  // Count how many times this place is scheduled in active itinerary
  const scheduledCount = scheduledPlaces.filter((s) => s.placeId === place.id).length;

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={(node) => {
        cardRef.current = node;
        setNodeRef(node);
      }}
      style={style}
      onClick={handleCardClick}
      {...listeners}
      {...attributes}
      className={`group relative rounded-xl p-3.5 border transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isDragging
          ? 'opacity-40 border-dashed border-emerald-500 bg-emerald-50/30'
          : isSelected
          ? 'bg-emerald-50/90 border-emerald-500 ring-4 ring-emerald-500/30 shadow-xl scale-[1.02] z-10'
          : isDragOverlay
          ? 'shadow-2xl ring-2 ring-emerald-500 scale-105 bg-white border-slate-200 cursor-grabbing'
          : isCandidateSelected
          ? 'bg-violet-50/80 border-violet-400 ring-4 ring-violet-400/30 shadow-md'
          : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Drag Handle Icon */}
        <div
          className="p-1 text-slate-300 hover:text-slate-600 rounded hover:bg-slate-100 shrink-0 self-center -ml-1 transition-colors"
          title="드래그해서 일차로 이동"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Category & Parking Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-slate-100 text-slate-700">
              {place.category}
            </span>

            {place.hasParking ? (
              <span
                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5 max-w-[160px]"
                title={place.parkingText || '주차 가능'}
              >
                <Car className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">{place.parkingText || '주차 가능'}</span>
              </span>
            ) : place.parkingText === '주차 불가' ? (
              <span
                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5"
                title="주차 불가"
              >
                <Car className="w-3 h-3 text-rose-500 shrink-0" />
                <span>주차 불가</span>
              </span>
            ) : (
              <span
                className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100/90 text-slate-500 border border-slate-200/80 flex items-center gap-0.5 max-w-[160px]"
                title={place.parkingText || '주차 정보 없음'}
              >
                <Car className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{place.parkingText || '주차 정보 없음'}</span>
              </span>
            )}

            {place.rating && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-800 flex items-center gap-0.5 border border-amber-200/60">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                {place.rating}
              </span>
            )}
          </div>

          {/* Place Name */}
          <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
            {place.name}
          </h3>

          <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
            {place.address}
          </p>
        </div>

        {/* Action Buttons: Candidate Select & Quick Add & Delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCandidateSelection(place.id);
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border shadow-2xs active:scale-95 cursor-pointer ${
              isCandidateSelected
                ? 'bg-violet-600 hover:bg-violet-700 text-white border-violet-600'
                : 'bg-slate-50 hover:bg-violet-50 text-slate-400 hover:text-violet-600 border-slate-200 hover:border-violet-300'
            }`}
            title="후보그룹으로 묶어서 나중에 고르기"
          >
            {isCandidateSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(naverMapUrl, '_blank', 'noopener,noreferrer');
            }}
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-blue-600 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-slate-200 hover:border-blue-600 shadow-2xs active:scale-95 cursor-pointer"
            title="네이버 지도에서 보기"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              addPlaceToDay(place.id, activeDayIndex);
            }}
            className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white flex items-center justify-center transition-all border border-emerald-200 hover:border-emerald-600 shadow-2xs active:scale-95 cursor-pointer"
            title={`${activeDayIndex + 1}일차 일정에 빠른 추가`}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`[${place.name}] 장소를 보관 목록에서 삭제하시겠습니까?`)) {
                removePlace(place.id);
              }
            }}
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-slate-200 hover:border-rose-600 shadow-2xs active:scale-95 cursor-pointer"
            title="보관 장소 목록에서 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Operating Hours & Day-off Information */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          {/* Operating Hours */}
          <div className="flex items-center gap-1 text-slate-700 font-semibold">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>영업시간: {place.operatingHours.open} ~ {place.operatingHours.close}</span>
          </div>

          {/* Day-Off Badge */}
          <div>
            {place.isEveryday ? (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                연중무휴
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5 text-rose-500" />
                {place.holiday_text || (place.dayOffs.length > 0
                  ? `${place.dayOffs.map((d) => WEEKDAY_KOREAN[d].replace('요일', '')).join(', ')} 휴무`
                  : '정기휴무')}
              </span>
            )}
          </div>
        </div>

        {/* Break Time & Last Order Badges */}
        {(place.operatingHours.breakTime || place.operatingHours.lastOrder) && (
          <div className="flex items-center gap-2 pl-4 text-[10px] flex-wrap">
            {place.operatingHours.breakTime && (
              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-bold flex items-center gap-1">
                <span>☕ 쉬는시간: {place.operatingHours.breakTime}</span>
              </span>
            )}
            {place.operatingHours.lastOrder && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold flex items-center gap-1">
                <span>🍽️ 라스트오더: {place.operatingHours.lastOrder}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Scheduled Counter Pill if place is added */}
      {scheduledCount > 0 && (
        <div className="absolute -top-1.5 -right-1.5 px-2 py-0.5 text-[9px] font-black rounded-full bg-blue-600 text-white shadow-md">
          {scheduledCount}회 일정에 추가됨
        </div>
      )}
    </div>
  );
}
