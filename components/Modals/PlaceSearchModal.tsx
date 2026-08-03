'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { saveTripToSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { Search, X, MapPin, Plus, Check, Loader2, Navigation, AlertCircle } from 'lucide-react';
import { Place } from '@/lib/types';

interface SearchResultItem {
  id: string;
  place_name: string;
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  lat: number;
  lng: number;
}

export default function PlaceSearchModal() {
  const {
    isSearchModalOpen,
    setIsSearchModalOpen,
    places,
    addPlaces,
    setSelectedPlaceId,
    setFocusPlaceLocation,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  if (!isSearchModalOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/search-place?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();

      if (data.success && data.places) {
        setResults(data.places);
        if (data.places.length === 0) {
          setErrorMsg(`'${query}'에 대한 검색 결과가 없습니다.`);
        }
      } else {
        setErrorMsg(data.error || '검색 결과를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('Search place error:', err);
      setErrorMsg('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlace = async (item: SearchResultItem) => {
    const normalizedId = item.id.startsWith('naver_place_') ? item.id : `naver_place_${item.id}`;

    const categoryOrAddr = `${item.category} ${item.roadAddress} ${item.address} ${item.place_name}`;
    const hasParkingInitial = /주차|발렛|주차장/.test(categoryOrAddr) && !/주차불가|주차\s*없음/.test(categoryOrAddr);

    const newPlace: Place = {
      id: normalizedId,
      name: item.place_name || item.name,
      category: item.category || '장소',
      address: item.roadAddress || item.address || '',
      lat: item.latitude || item.lat,
      lng: item.longitude || item.lng,
      hasParking: hasParkingInitial,
      operatingHours: {
        open: '00:00',
        close: '24:00',
        display: '영업시간 확인 중',
      },
      isEveryday: true,
      dayOffs: [],
    };

    // Add place to Zustand store
    addPlaces([newPlace]);

    // Track added state
    setAddedIds((prev) => new Set(prev).add(normalizedId).add(item.id));

    // Focus & Center Naver Map camera directly to new place location
    setSelectedPlaceId(normalizedId);
    setFocusPlaceLocation({
      lat: newPlace.lat,
      lng: newPlace.lng,
      timestamp: Date.now(),
    });

    // Background parse real business hours and day-offs if SID is numeric
    const cleanSid = item.id.replace(/^[^\d]+/, '').replace(/_\d+$/, '');
    if (/^\d+$/.test(cleanSid)) {
      try {
        const parseRes = await fetch(`/api/parse-naver?sid=${cleanSid}`);
        const parseData = await parseRes.json();
        if (parseData.success && parseData.place) {
          // Ensure place ID is normalized
          addPlaces([{ ...parseData.place, id: normalizedId }]);
        }
      } catch (err) {
        console.warn('Background parse failed:', err);
      }
    }

    // Immediately persist to Supabase DB
    const state = useAppStore.getState();
    if (isSupabaseConfigured()) {
      try {
        await saveTripToSupabase({
          tripId: state.activeTripId,
          title: state.activeTripTitle || '스마트 여행',
          startDate: state.startDate,
          dayCount: state.dayCount,
          places: state.places,
          scheduledPlaces: state.scheduledPlaces,
          dayItineraries: state.dayItineraries,
        });
      } catch (e) {
        console.warn('Instant save error during place search add:', e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                네이버 지도 장소 검색 및 리스트 추가
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                검색 후 [+ 장소 추가]를 누르면 지도 마커와 리스트에 실시간 반영됩니다.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSearchModalOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="장소명 또는 지역 키워드 입력 (예: 궁전제과 충장점, 제일곱창...)"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>검색 중...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>검색</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Results Scroll Area */}
        <div className="flex-1 max-h-[420px] overflow-y-auto p-4 space-y-3 bg-slate-50/50 min-h-[260px]">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
              <p className="text-xs font-bold text-slate-700">네이버 지도의 최신 장소 정보를 검색하는 중입니다...</p>
            </div>
          ) : errorMsg ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 rounded-xl bg-white">
              <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-xs font-bold text-slate-700">{errorMsg}</p>
              <p className="text-[11px] text-slate-400 mt-1">다른 키워드나 지역명을 포함하여 검색해보세요.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 rounded-xl bg-white">
              <MapPin className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">검색어를 입력하고 [검색] 버튼을 누르세요.</p>
              <p className="text-[11px] text-slate-400 mt-1">네이버 지도 기반 장소명, 맛집, 카페, 관광명소 등을 자유롭게 찾으실 수 있습니다.</p>
            </div>
          ) : (
            results.map((item) => {
              const normId = item.id.startsWith('naver_place_') ? item.id : `naver_place_${item.id}`;
              const isAdded = addedIds.has(item.id) || addedIds.has(normId) || places.some((p) => p.id === item.id || p.id === normId);
              return (
                <div
                  key={item.id}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs flex items-center justify-between gap-3 transition-all hover:shadow-md"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {item.place_name}
                    </h4>

                    <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{item.address}</span>
                    </p>

                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>좌표: lat {item.latitude?.toFixed(4)}, lng {item.longitude?.toFixed(4)}</span>
                      <span>• ID: {item.id}</span>
                    </div>
                  </div>

                  {/* Add Place Action Button */}
                  <button
                    onClick={() => handleAddPlace(item)}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shrink-0 ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>리스트에 추가됨</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ 장소 추가</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            <span>장소를 추가하면 지도의 중심이 해당 장소로 자동 이동합니다.</span>
          </span>

          <button
            onClick={() => setIsSearchModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-200/60 text-slate-700 font-bold border border-slate-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
