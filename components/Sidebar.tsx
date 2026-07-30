'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import PlaceCard from './PlaceCard';
import { Search, Filter, PlusCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { DayOffFilter, DayOfWeek, Place } from '@/lib/types';

export default function Sidebar() {
  const {
    places,
    addPlaces,
    filterDayOff,
    setFilterDayOff,
    filterParkingOnly,
    searchQuery,
    setSearchQuery,
    setIsIngestModalOpen,
    setIsSearchModalOpen,
    selectedPlaceId,
  } = useAppStore();

  const [isRefreshingHours, setIsRefreshingHours] = useState(false);

  const refreshOperatingHours = async () => {
    if (places.length === 0) return;
    setIsRefreshingHours(true);
    try {
      const updatedPlaces: Place[] = [];
      for (const place of places) {
        const cleanSid = place.id.replace(/^[^\d]+/, '').replace(/_\d+$/, '');
        if (/^\d+$/.test(cleanSid)) {
          const res = await fetch(`/api/parse-naver?sid=${cleanSid}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.place) {
              updatedPlaces.push({
                ...place,
                operatingHours: data.place.operatingHours,
                dayOffs: data.place.dayOffs,
                isEveryday: data.place.isEveryday,
                dayOffRaw: data.place.dayOffRaw,
                holiday_text: data.place.holiday_text,
                hasParking: data.place.hasParking,
              });
              continue;
            }
          }
        }
        updatedPlaces.push(place);
      }
      addPlaces(updatedPlaces);
    } catch (err) {
      console.warn('Refresh hours error:', err);
    } finally {
      setIsRefreshingHours(false);
    }
  };

  // Requirement 2: Dynamically generate Day-Off Filter Buttons
  // Only render weekday filter buttons if at least 1 place actually closes on that weekday
  const dynamicFilterOptions = React.useMemo(() => {
    const activeOffDays = new Set<DayOfWeek>();

    places.forEach((p) => {
      if (!p.isEveryday && p.dayOffs) {
        p.dayOffs.forEach((d) => activeOffDays.add(d));
      }
    });

    const options = [
      { id: 'all', label: `전체 (${places.length})`, value: 'ALL' as DayOffFilter },
    ];

    if (places.length > 0) {
      const everydayCount = places.filter((p) => p.isEveryday).length;
      options.push({
        id: 'everyday',
        label: `연중무휴 (${everydayCount})`,
        value: 'EVERYDAY' as DayOffFilter,
      });
    }

    const weekdayConfig: { value: DayOffFilter; label: string; day: DayOfWeek }[] = [
      { value: 'Mon', label: '월요일', day: 'Mon' },
      { value: 'Tue', label: '화요일', day: 'Tue' },
      { value: 'Wed', label: '수요일', day: 'Wed' },
      { value: 'Thu', label: '목요일', day: 'Thu' },
      { value: 'Fri', label: '금요일', day: 'Fri' },
      { value: 'Sat', label: '토요일', day: 'Sat' },
      { value: 'Sun', label: '일요일', day: 'Sun' },
    ];

    // Filter only weekdays that have at least 1 closing place
    weekdayConfig.forEach((cfg) => {
      if (activeOffDays.has(cfg.day)) {
        const count = places.filter((p) => !p.isEveryday && p.dayOffs.includes(cfg.day)).length;
        options.push({
          id: cfg.value,
          label: `${cfg.label} 휴무 (${count})`,
          value: cfg.value,
        });
      }
    });

    return options;
  }, [places]);

  // Filter Logic based on user criteria (Ensures map-clicked places are ALWAYS rendered & scrolled into view!)
  const filteredPlaces = React.useMemo(() => {
    return places.filter((place) => {
      // If user clicked this marker on map, ALWAYS render it in sidebar so it can scroll into view!
      if (selectedPlaceId === place.id) return true;

      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = place.name.toLowerCase().includes(q);
        const matchesCat = place.category.toLowerCase().includes(q);
        const matchesAddr = place.address.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesAddr) return false;
      }

      // 2. Parking Filter
      if (filterParkingOnly && !place.hasParking) {
        return false;
      }

      // 3. Day Off Filter
      if (filterDayOff === 'ALL') return true;
      if (filterDayOff === 'EVERYDAY') return place.isEveryday;

      // Check if place is closed on the selected weekday
      return !place.isEveryday && place.dayOffs.includes(filterDayOff as any);
    });
  }, [places, filterDayOff, filterParkingOnly, searchQuery, selectedPlaceId]);

  return (
    <aside className="w-80 h-full bg-white border-r border-slate-200 flex flex-col z-20 shrink-0 shadow-xs">
      {/* Sidebar Header & Ingestion Trigger */}
      <div className="p-3.5 border-b border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 whitespace-nowrap">
            <span>보관된 장소</span>
            <span className="px-2.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300/70 whitespace-nowrap">
              {filteredPlaces.length}곳
            </span>
          </h2>

          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="text-xs text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100/80 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-300/80 transition-all whitespace-nowrap shadow-2xs"
            title="네이버 지도 기반 새 장소 검색 및 추가"
          >
            <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="whitespace-nowrap">장소 검색</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="목록 내 장소명/지역 필터..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 text-xs text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Dynamic Day-Off Filter Tabs */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/60">
        <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-500 mb-2">
          <Filter className="w-3 h-3 text-emerald-600" />
          <span>휴무일별 동적 모아보기 필터</span>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
          {dynamicFilterOptions.map((opt) => {
            const isSelected = filterDayOff === opt.value;
            return (
              <button
                key={opt.id}
                onClick={() => setFilterDayOff(opt.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Place Card List Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/30">
        {filteredPlaces.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 rounded-2xl bg-white">
            <CheckCircle2 className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              조건에 일치하는 장소가 없습니다.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              상단 [장소 검색] 버튼으로 원하는 새로운 장소를 검색해 보세요.
            </p>
          </div>
        ) : (
          filteredPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))
        )}
      </div>
    </aside>
  );
}
