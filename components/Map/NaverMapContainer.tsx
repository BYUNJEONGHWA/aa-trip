'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { getDayColorTheme } from '@/lib/constants';
import { Place, ScheduledPlace } from '@/lib/types';
import { calculateDistanceKm, estimateTravelTimeMinutes, isPlaceClosedOnDate, getKoreanDayOfWeek } from '@/lib/routeOptimizer';
import { Navigation, AlertTriangle, Maximize2, Minimize2, ChevronLeft, ChevronRight, Layers, MapPin, Sparkles, Calendar, RotateCcw, RefreshCw, Key } from 'lucide-react';
import NaverKeyModal from '../Modals/NaverKeyModal';

declare global {
  interface Window {
    naver: any;
    __NAVER_MAP_AUTH_FAILED__?: boolean;
    navermap_authFailure?: () => void;
  }
}

interface NaverMapContainerProps {
  mapViewState?: 'NORMAL' | 'MINIMIZED' | 'MAXIMIZED';
  setMapViewState?: (state: 'NORMAL' | 'MINIMIZED' | 'MAXIMIZED') => void;
  isMobileVisible?: boolean;
}

export default function NaverMapContainer({
  mapViewState = 'NORMAL',
  setMapViewState,
  isMobileVisible = true,
}: NaverMapContainerProps) {
  const {
    places,
    scheduledPlaces,
    dayCount,
    dayItineraries,
    activeDayIndex,
    setActiveDayIndex,
    filterDayOff,
    setSelectedPlaceId,
    focusPlaceLocation,
  } = useAppStore();

  const mapRef = useRef<HTMLDivElement>(null);
  const naverMapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);

  // Track initial fit bounds to preserve user's zoom & center position when adding schedules
  const hasInitialFitRef = useRef(false);

  // Move Naver Map camera center to newly added place
  useEffect(() => {
    if (!focusPlaceLocation || !naverMapInstance.current || !window.naver?.maps) return;
    try {
      const center = new window.naver.maps.LatLng(focusPlaceLocation.lat, focusPlaceLocation.lng);
      naverMapInstance.current.setCenter(center);
      naverMapInstance.current.setZoom(15);
    } catch (e) {
      console.warn('Center map error:', e);
    }
  }, [focusPlaceLocation]);

  // Handle Map Resizing when viewState changes
  useEffect(() => {
    if (naverMapInstance.current && window.naver?.maps) {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if (naverMapInstance.current.setSize) {
          const container = mapRef.current;
          if (container) {
            naverMapInstance.current.setSize(new window.naver.maps.Size(container.clientWidth, container.clientHeight));
          }
        }
      }, 200);
    }
  }, [mapViewState]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE_DAY'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mapCustomDate, setMapCustomDate] = useState<string | null>(null);
  const [isAuthFailed, setIsAuthFailed] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // Listen for Naver Map API authentication failure event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.__NAVER_MAP_AUTH_FAILED__) {
      setIsAuthFailed(true);
    }

    const handleAuthFailed = () => {
      setIsAuthFailed(true);
    };

    window.addEventListener('naver_map_auth_failed', handleAuthFailed);
    return () => {
      window.removeEventListener('naver_map_auth_failed', handleAuthFailed);
    };
  }, []);

  const activeItinerary = dayItineraries.find((it) => it.dayIndex === activeDayIndex);
  const activeDateStr = activeItinerary?.dateStr || '2026-08-16';
  const effectiveDateStr = mapCustomDate || activeDateStr;
  const effectiveKoreanDay = getKoreanDayOfWeek(effectiveDateStr);

  const closedPlacesCount = React.useMemo(() => {
    if (!effectiveDateStr) return 0;
    return places.filter((p) => isPlaceClosedOnDate(p, effectiveDateStr)).length;
  }, [places, effectiveDateStr]);

  const clientId = (process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || '').trim();

  // Create Place Map for quick O(1) lookup
  const placeMap = React.useMemo(() => {
    const map = new Map<string, Place>();
    places.forEach((p) => map.set(p.id, p));
    return map;
  }, [places]);

  // Calculate day-by-day distance and travel time summary
  const daySummaries = React.useMemo(() => {
    const summaries: Record<number, { count: number; totalDistance: number; totalTime: number }> = {};

    for (let dayIdx = 0; dayIdx < dayCount; dayIdx++) {
      const daySchedules = scheduledPlaces
        .filter((s) => s.dayIndex === dayIdx)
        .sort((a, b) => a.order - b.order);

      let totalDist = 0;
      let totalTime = 0;

      for (let i = 0; i < daySchedules.length - 1; i++) {
        const p1 = placeMap.get(daySchedules[i].placeId);
        const p2 = placeMap.get(daySchedules[i + 1].placeId);
        if (p1 && p2) {
          const dist = calculateDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
          totalDist += dist;
          totalTime += estimateTravelTimeMinutes(dist);
        }
      }

      summaries[dayIdx] = {
        count: daySchedules.length,
        totalDistance: Math.round(totalDist * 10) / 10,
        totalTime: Math.round(totalTime),
      };
    }
    return summaries;
  }, [scheduledPlaces, dayCount, placeMap]);

  // Function to calculate map bounds for fitBounds
  const fitMapToBounds = useCallback(() => {
    if (!naverMapInstance.current || !window.naver?.maps) return;

    const bounds = new window.naver.maps.LatLngBounds();
    let hasValidPoints = false;

    places.forEach((p) => {
      if (p.lat && p.lng) {
        bounds.extend(new window.naver.maps.LatLng(p.lat, p.lng));
        hasValidPoints = true;
      }
    });

    if (hasValidPoints) {
      naverMapInstance.current.fitBounds(bounds, {
        maxZoom: 15,
      });
    }
  }, [places]);

  const [authDomain, setAuthDomain] = useState<string | null>(null);

  // Set current hostname for domain auth troubleshooting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAuthDomain(window.location.host);
    }
  }, []);

  // Dynamic Script Injection & Map Instance Initialization for Mobile 100% Reliability
  const createMapInstance = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!window.naver || !window.naver.maps) return;
    if (!mapRef.current) return;

    // Do NOT initialize map inside a 0-width hidden container (wait until visible!)
    const width = mapRef.current.clientWidth;
    const height = mapRef.current.clientHeight;
    if (width === 0 && height === 0 && !isMobileVisible) return;

    if (!naverMapInstance.current) {
      const defaultCenter = new window.naver.maps.LatLng(35.15, 126.90);
      const mapOptions = {
        center: defaultCenter,
        zoom: 12,
        zoomControl: true,
        zoomControlOptions: {
          position: window.naver.maps.Position.TOP_RIGHT,
        },
        mapTypeControl: false,
      };

      const map = new window.naver.maps.Map(mapRef.current, mapOptions);
      naverMapInstance.current = map;
      setIsLoaded(true);

      // Immediate mobile resize recalculation
      window.dispatchEvent(new Event('resize'));
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if (map.setSize && mapRef.current) {
          const w = mapRef.current.clientWidth || 360;
          const h = mapRef.current.clientHeight || 400;
          map.setSize(new window.naver.maps.Size(w, h));
        }
      }, 150);
    }
  }, [isMobileVisible]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.__NAVER_MAP_AUTH_FAILED__) {
      setIsAuthFailed(true);
    }

    const storedKey = localStorage.getItem('NAVER_MAP_CLIENT_ID') || '';
    const clientId = (storedKey || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || '6h6sixegq1').trim();

    // 1. If window.naver.maps already exists
    if (window.naver && window.naver.maps) {
      createMapInstance();
      return;
    }

    // 2. Check if script tag is already in DOM
    const existingScript = document.getElementById('naver-map-script');
    if (existingScript) {
      existingScript.addEventListener('load', createMapInstance);
      return () => existingScript.removeEventListener('load', createMapInstance);
    }

    // 3. Inject Script Dynamically into DOM
    const script = document.createElement('script');
    script.id = 'naver-map-script';
    script.type = 'text/javascript';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}&submodules=geocoder`;
    script.async = true;

    script.onload = () => {
      createMapInstance();
    };

    document.head.appendChild(script);
  }, [createMapInstance]);

  // Robust Naver Map Resize & Re-initialization Trigger Helper
  const triggerMapResize = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('resize'));
    if (!naverMapInstance.current) {
      createMapInstance();
      return;
    }
    if (naverMapInstance.current && window.naver?.maps) {
      window.naver.maps.Event.trigger(naverMapInstance.current, 'resize');
      const container = mapRef.current;
      if (container) {
        const w = container.clientWidth || 360;
        const h = container.clientHeight || 400;
        naverMapInstance.current.setSize(new window.naver.maps.Size(w, h));
      }
    }
  }, [createMapInstance]);

  // Force recalculate map size on mobile view state, load, & mobile tab switching
  useEffect(() => {
    if (isMobileVisible || isLoaded) {
      createMapInstance();
      triggerMapResize();
      const timer1 = setTimeout(triggerMapResize, 50);
      const timer2 = setTimeout(triggerMapResize, 200);
      const timer3 = setTimeout(triggerMapResize, 500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isLoaded, mapViewState, isMobileVisible, triggerMapResize, createMapInstance]);

  // Fit bounds ONLY once when map is loaded & places are available
  useEffect(() => {
    if (isLoaded && places.length > 0 && !hasInitialFitRef.current) {
      fitMapToBounds();
      hasInitialFitRef.current = true;
    }
  }, [isLoaded, places, fitMapToBounds]);

  // Update Markers & Day Polylines whenever state changes
  useEffect(() => {
    if (!isLoaded || !naverMapInstance.current || !window.naver?.maps) return;

    const map = naverMapInstance.current;

    // Clear existing markers & polylines
    markersRef.current.forEach((m) => m.setMap(null));
    polylinesRef.current.forEach((p) => p.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];

    const activeItinerary = dayItineraries.find((it) => it.dayIndex === activeDayIndex);
    const activeDateStr = activeItinerary?.dateStr || '';

    // Render Place Markers
    places.forEach((place) => {
      const daySchedules = scheduledPlaces.filter((s) => s.placeId === place.id);
      const isScheduledInActiveDay = daySchedules.some((s) => s.dayIndex === activeDayIndex);
      const firstSchedule = daySchedules[0];
      const scheduledDayIdx = firstSchedule ? firstSchedule.dayIndex : -1;
      const dayTheme = scheduledDayIdx >= 0 ? getDayColorTheme(scheduledDayIdx) : null;

      const isClosedOnActiveDay = isPlaceClosedOnDate(place, effectiveDateStr);

      if (activeTab === 'ACTIVE_DAY' && !isScheduledInActiveDay) {
        return;
      }

      let markerBg = isClosedOnActiveDay
        ? 'bg-gradient-to-r from-rose-600 to-red-500 text-white ring-2 ring-rose-400 shadow-lg animate-pulse'
        : dayTheme
        ? `${dayTheme.badgeBg} text-white border-2 border-white shadow-md`
        : 'bg-slate-700 text-white border-2 border-white shadow-sm';

      let statusBadgeHtml = '';
      if (isClosedOnActiveDay) {
        statusBadgeHtml = `
          <div style="margin-top:2px; font-size:10px; font-weight:800; color:#e11d48; background:#fff1f2; border:1px solid #f43f5e; padding:1px 5px; border-radius:4px; white-space:nowrap; width:max-content; word-break:keep-all;">
            ⚠️ ${effectiveDateStr.substring(5)} (${effectiveKoreanDay}) 실제 휴무
          </div>
        `;
      } else if (scheduledDayIdx >= 0) {
        statusBadgeHtml = `
          <div style="margin-top:2px; font-size:10px; font-weight:800; color:${dayTheme?.color}; background:#ffffff; border:1px solid ${dayTheme?.color}; padding:1px 5px; border-radius:4px; white-space:nowrap; width:max-content; word-break:keep-all;">
            ${scheduledDayIdx + 1}일차 ${firstSchedule.order + 1}번째
          </div>
        `;
      }

      const markerContent = `
        <div style="cursor:pointer; display:inline-flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); white-space:nowrap; width:max-content; word-break:keep-all;" id="map-marker-${place.id}">
          <div class="px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-md ${markerBg}" style="white-space:nowrap; width:max-content;">
            <span>${isClosedOnActiveDay ? '⚠️' : '📍'} ${place.name}</span>
          </div>
          ${statusBadgeHtml}
        </div>
      `;

      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(place.lat, place.lng),
        map,
        title: place.name,
        icon: {
          content: markerContent,
          size: new window.naver.maps.Size(0, 0),
          anchor: new window.naver.maps.Point(0, 0),
        },
      });

      window.naver.maps.Event.addListener(marker, 'click', () => {
        const state = useAppStore.getState();
        if (state.selectedPlaceId === place.id) {
          // Second click on already selected place -> Add to active day schedule!
          state.addPlaceToDay(place.id, state.activeDayIndex);
          setToastMessage(`✨ [${place.name}]이(가) ${state.activeDayIndex + 1}일차 일정에 추가되었습니다!`);
          setTimeout(() => setToastMessage(null), 2500);
        } else {
          // First click -> Select place
          setSelectedPlaceId(place.id);
        }
      });

      window.naver.maps.Event.addListener(marker, 'dblclick', () => {
        const state = useAppStore.getState();
        state.addPlaceToDay(place.id, state.activeDayIndex);
        setToastMessage(`✨ [${place.name}]이(가) ${state.activeDayIndex + 1}일차 일정에 추가되었습니다!`);
        setTimeout(() => setToastMessage(null), 2500);
      });

      markersRef.current.push(marker);
    });

    // Render Route Polylines
    for (let dayIdx = 0; dayIdx < dayCount; dayIdx++) {
      if (activeTab === 'ACTIVE_DAY' && dayIdx !== activeDayIndex) {
        continue;
      }

      const daySchedules = scheduledPlaces
        .filter((s) => s.dayIndex === dayIdx)
        .sort((a, b) => a.order - b.order);

      const pathCoords: any[] = [];

      daySchedules.forEach((sched) => {
        const place = placeMap.get(sched.placeId);
        if (place && place.lat && place.lng) {
          pathCoords.push(new window.naver.maps.LatLng(place.lat, place.lng));
        }
      });

      if (pathCoords.length >= 2) {
        const dayTheme = getDayColorTheme(dayIdx);

        const polyline = new window.naver.maps.Polyline({
          map,
          path: pathCoords,
          strokeColor: dayTheme.color,
          strokeOpacity: dayIdx === activeDayIndex ? 0.9 : 0.4,
          strokeWeight: dayIdx === activeDayIndex ? 5 : 3,
          strokeStyle: dayIdx === activeDayIndex ? 'solid' : 'shortdash',
        });

        polylinesRef.current.push(polyline);
      }
    }
  }, [
    isLoaded,
    places,
    scheduledPlaces,
    dayCount,
    activeDayIndex,
    activeTab,
    dayItineraries,
    placeMap,
    setSelectedPlaceId,
    effectiveDateStr,
  ]);

  const activeWeekdayLabel = activeItinerary?.weekdayLabel || '';

  // Collapsed Minimized Vertical Bar view
  if (mapViewState === 'MINIMIZED') {
    return (
      <div className="h-full w-full bg-slate-900 flex flex-col items-center justify-between py-4 border-l border-slate-800 shadow-2xl">
        <button
          onClick={() => setMapViewState?.('NORMAL')}
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold flex flex-col items-center gap-2 shadow-lg transition-all hover:scale-105"
          title="네이버 지도 크게 열기"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="[writing-mode:vertical-lr] text-xs tracking-widest py-2">
            지도 펼치기
          </span>
        </button>

        <div className="flex flex-col items-center gap-3 text-white">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
            <MapPin className="w-4 h-4" />
          </div>
          <span className="[writing-mode:vertical-lr] text-[11px] text-slate-400 font-semibold">
            Naver Maps
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col bg-slate-100 border-l border-slate-200 overflow-y-auto md:overflow-hidden">
      {/* Top Controls Bar (Desktop: Floating Absolute / Mobile: Static Stack) */}
      <div className="relative md:absolute md:top-4 md:left-4 md:right-4 z-20 bg-white/95 backdrop-blur-md p-2.5 rounded-none md:rounded-xl border-b md:border border-slate-200 shadow-xs md:shadow-md flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View Tab Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all text-xs ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              전체 동선
            </button>
            <button
              onClick={() => setActiveTab('ACTIVE_DAY')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all text-xs ${
                activeTab === 'ACTIVE_DAY'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              선택 일차만 ({activeDayIndex + 1}일차)
            </button>
          </div>

          <button
            onClick={fitMapToBounds}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 shadow-2xs transition-all text-xs"
            title="모든 장소가 한눈에 보이도록 지도 화면 카메라 범위 자동 맞춤"
          >
            <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>범위 맞춤</span>
          </button>
        </div>

        {/* Interactive Map Calendar Date Selector Widget */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-rose-50/90 text-rose-800 border border-rose-200 px-2 py-1 rounded-lg text-xs font-black shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="text-[11px] font-bold text-rose-900 hidden sm:inline">휴무 조회:</span>
            <input
              type="date"
              value={effectiveDateStr}
              onChange={(e) => setMapCustomDate(e.target.value)}
              className="bg-white border border-rose-300 rounded px-1.5 py-0.5 text-xs font-black text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer shadow-2xs"
            />
            <span className="text-[11px] font-extrabold text-rose-700">
              ({effectiveKoreanDay})
            </span>
            <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black ml-0.5 shrink-0">
              ⚠️ {closedPlacesCount}곳 휴무
            </span>

            {mapCustomDate && (
              <button
                onClick={() => setMapCustomDate(null)}
                className="ml-1 flex items-center gap-0.5 text-[10px] bg-white hover:bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-300 transition-colors font-bold"
                title="스케줄러 선택 날짜로 복원"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">스케줄 날짜로</span>
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setMapViewState?.('MINIMIZED')}
              className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
              title="지도 접기"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>

            {mapViewState !== 'MAXIMIZED' ? (
              <button
                onClick={() => setMapViewState?.('MAXIMIZED')}
                className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                title="지도 크게 보기"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setMapViewState?.('NORMAL')}
                className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                title="복원"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Feedback Notification when place added via double click */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500 font-extrabold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-amber-300 animate-spin shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Naver Map Canvas Area */}
      <div
        className="w-full h-[400px] min-h-[380px] md:h-full relative z-10 box-border shrink-0"
        style={{ width: '100%', height: '400px', display: 'block', minHeight: '380px', flexShrink: 0 }}
      >
        {isAuthFailed ? (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg animate-bounce">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-rose-400">네이버 지도 인증 실패 (OpenAPI 3.0)</h4>
              <p className="text-xs text-slate-300 max-w-sm">
                네이버 클라우드 콘솔에 현재 접속 주소가 등록되어 있지 않거나 Client ID가 일치하지 않습니다.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl max-w-sm w-full text-left text-xs space-y-2 shadow-2xl">
              <div className="flex items-center justify-between text-slate-400 font-bold text-[11px]">
                <span>현재 접속 URL</span>
                <span className="font-mono text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{authDomain}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                👉 <strong>해결 방법:</strong> 네이버 클라우드 콘솔 (<a href="https://console.ncloud.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-bold">console.ncloud.com</a>) ➔ AI·NAVER API ➔ Application ➔ <strong>Web 서비스 URL</strong>에 <code className="text-emerald-300 font-bold">https://{authDomain}</code> 주소를 추가 등록하세요.
              </p>
            </div>

            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>네이버 Client ID 변경하기</span>
            </button>
          </div>
        ) : !isLoaded ? (
          <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center gap-2 text-white font-extrabold text-xs">
            <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-sm font-black">네이버 지도 SDK 불러오는 중...</span>
            {authDomain && (
              <div className="mt-2 text-[11px] text-slate-800 bg-white p-3 rounded-xl border border-slate-300 shadow-lg max-w-xs text-left leading-snug">
                💡 <strong>현재 접속 도메인:</strong> <code className="text-emerald-700 font-bold bg-slate-100 px-1 py-0.5 rounded">{authDomain}</code><br/>
                <span className="text-slate-500 font-medium text-[10px] mt-1 block">
                  모바일 브라우저나 Vercel에서 안 보일 경우, Naver Cloud 콘솔 (AI.Naver API &gt; Web Dynamic Map)의 &quot;Web 서비스 URL&quot;에 위 도메인이 등록되어 있는지 확인해 보세요.
                </span>
              </div>
            )}
          </div>
        ) : null}
        <div
          ref={mapRef}
          className="w-full h-full min-h-[380px]"
          style={{ width: '100%', height: '400px', display: 'block', minHeight: '380px', flexShrink: 0 }}
        />
      </div>

      {/* Bottom Summary Bar & Mobile Saved Places Day-Off Status */}
      <div className="relative md:absolute md:bottom-4 md:left-4 md:right-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-none md:rounded-xl border-t md:border border-slate-200 text-xs text-slate-700 shadow-lg flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold">
            <Navigation className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>선택 일차 ({activeDayIndex + 1}일차 - {activeDateStr} {activeWeekdayLabel}) 이동 요약:</span>
          </div>
          <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs flex-wrap">
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              장소: <strong className="text-emerald-700">{daySummaries[activeDayIndex]?.count || 0}곳</strong>
            </span>
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              거리: <strong className="text-blue-700">{daySummaries[activeDayIndex]?.totalDistance || 0} km</strong>
            </span>
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              시간: <strong className="text-amber-700">{daySummaries[activeDayIndex]?.totalTime || 0} 분</strong>
            </span>
          </div>
        </div>

        {/* Mobile View Saved Places Open/Closed List */}
        <div className="md:hidden pt-2 border-t border-slate-200">
          <div className="font-extrabold text-xs text-slate-900 mb-2 flex items-center justify-between">
            <span>📍 저장된 장소 영업/휴무 목록 ({places.length}곳)</span>
            <span className="text-rose-600">⚠️ {closedPlacesCount}곳 휴무</span>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border rounded-lg p-1.5 bg-slate-50">
            {places.map((p) => {
              const isClosed = isPlaceClosedOnDate(p, effectiveDateStr);
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlaceId(p.id)}
                  className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between border cursor-pointer ${
                    isClosed ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{isClosed ? '⚠️' : '📍'}</span>
                    <span className="font-black">{p.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      isClosed ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isClosed ? '실제 휴무' : '영업 중'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>NAVER Official Maps SDK (Connected)</span>
          </span>
        </div>
      </div>

      <NaverKeyModal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} />
    </div>
  );
}
