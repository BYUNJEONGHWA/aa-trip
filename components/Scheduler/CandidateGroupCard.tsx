'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { ScheduledPlace } from '@/lib/types';
import { Users, Check, Trash2, Clock } from 'lucide-react';

interface CandidateGroupCardProps {
  groupId: string;
  candidates: ScheduledPlace[];
}

export default function CandidateGroupCard({ groupId, candidates }: CandidateGroupCardProps) {
  const { places, confirmCandidate, removeScheduledPlace, removeCandidateGroup, setSelectedPlaceId, setFocusPlaceLocation } =
    useAppStore();

  return (
    <div className="bg-violet-50/60 rounded-xl p-3 border border-dashed border-violet-300 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-violet-800 font-black text-xs">
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>후보 {candidates.length}곳 · 하나를 골라주세요</span>
        </div>
        <button
          onClick={() => removeCandidateGroup(groupId)}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
          title="후보 그룹 전체 삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {candidates.map((c) => {
          const place = places.find((p) => p.id === c.placeId);
          if (!place) return null;
          return (
            <div
              key={c.scheduleId}
              onClick={() => {
                setSelectedPlaceId(place.id);
                setFocusPlaceLocation({ lat: place.lat, lng: place.lng, timestamp: Date.now() });
              }}
              className="flex items-center justify-between gap-2 bg-white rounded-lg p-2 border border-violet-200 cursor-pointer hover:border-violet-400 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-900 truncate">{place.name}</h4>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                  <span className="truncate max-w-[80px]">{place.category}</span>
                  <span className="text-slate-300">·</span>
                  <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                  <span>
                    {place.operatingHours.open} ~ {place.operatingHours.close}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmCandidate(groupId, c.scheduleId);
                  }}
                  className="px-2 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black flex items-center gap-1 transition-colors"
                  title="이 장소로 확정"
                >
                  <Check className="w-3 h-3" />
                  <span>확정</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScheduledPlace(c.scheduleId);
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="후보에서 제외"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
