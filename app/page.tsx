'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import KanbanBoard from '@/components/Scheduler/KanbanBoard';
import TripFolderTabs from '@/components/Scheduler/TripFolderTabs';
import NaverMapContainer from '@/components/Map/NaverMapContainer';
import DataIngestionModal from '@/components/Modals/DataIngestionModal';
import ExportModal from '@/components/Modals/ExportModal';
import PlaceSearchModal from '@/components/Modals/PlaceSearchModal';
import SupabaseSyncModal from '@/components/Modals/SupabaseSyncModal';
import FolderPasswordGate from '@/components/Modals/FolderPasswordGate';
import PlaceCard from '@/components/PlaceCard';
import ScheduledCard from '@/components/Scheduler/ScheduledCard';
import { useAppStore } from '@/lib/store';
import {
  isSupabaseConfigured,
  fetchAllTripsFromSupabase,
  loadTripFromSupabase,
  fetchLatestTripFromSupabase,
  fetchLatestTripStamp,
  subscribeToTripChanges,
  saveTripToSupabase,
  isSelfWriting,
} from '@/lib/supabase';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';

import { MapPin, Calendar, Map as MapIcon } from 'lucide-react';

export default function Home() {
  const {
    activeTripId,
    activeTripTitle,
    setActiveTrip,
    addPlaceToDay,
    moveScheduleToDay,
    reorderDaySchedule,
    scheduledPlaces,
    places,
    addPlaces,
    activeDayIndex,
    setActiveDayIndex,
    isDbInitialLoaded,
    setIsDbInitialLoaded,
    loadFullTripState,
    dayItineraries,
    startDate,
    dayCount,
    setAutoSaveStatus,
  } = useAppStore();

  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [mapViewState, setMapViewState] = useState<'NORMAL' | 'MINIMIZED' | 'MAXIMIZED'>('NORMAL');
  const [mobileActiveView, setMobileActiveView] = useState<'PLACES' | 'SCHEDULER' | 'MAP'>('SCHEDULER');

  // Mobile swipe between the 보관 장소 / 스케줄러 / 네이버 지도 tabs, as an alternative to
  // tapping the bottom nav. Only acts on a clean, mostly-horizontal, decisive swipe so it
  // doesn't fight the scheduler's drag-and-drop or the map's own pan/pinch gestures.
  const MOBILE_VIEW_ORDER: Array<'PLACES' | 'SCHEDULER' | 'MAP'> = ['PLACES', 'SCHEDULER', 'MAP'];
  const workspaceRef = React.useRef<HTMLDivElement | null>(null);
  const touchStateRef = React.useRef<{ x: number; y: number; horizontalLock: boolean } | null>(null);

  // Kept fresh every render without going in the touch effect's deps below - that effect
  // only needs to re-bind its listeners when mobileActiveView changes, not on every
  // schedule edit (which would otherwise thrash addEventListener on each keystroke).
  const dayItinerariesRef = React.useRef(dayItineraries);
  dayItinerariesRef.current = dayItineraries;
  const activeDayIndexRef = React.useRef(activeDayIndex);
  activeDayIndexRef.current = activeDayIndex;

  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 768) return;
      const t = e.touches[0];
      touchStateRef.current = { x: t.clientX, y: t.clientY, horizontalLock: false };
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = touchStateRef.current;
      if (!state || window.innerWidth >= 768) return;
      const t = e.touches[0];
      const deltaX = t.clientX - state.x;
      const deltaY = t.clientY - state.y;

      if (!state.horizontalLock) {
        // Once the gesture clearly reads as horizontal, take it over — this is what stops
        // the page from also rubber-band/pan-scrolling underneath our swipe (the "화면이
        // 왼쪽으로 치우친다" shift), since the browser never gets to touch-scroll it.
        if (Math.abs(deltaX) > 15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          state.horizontalLock = true;
        } else if (Math.abs(deltaY) > 15) {
          touchStateRef.current = null; // vertical scroll — let the browser handle it
          return;
        }
      }

      if (state.horizontalLock) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const state = touchStateRef.current;
      touchStateRef.current = null;
      if (!state || window.innerWidth >= 768) return;

      const t = e.changedTouches[0];
      const deltaX = t.clientX - state.x;
      const deltaY = t.clientY - state.y;
      const SWIPE_THRESHOLD_PX = 80;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

      // Inside the Scheduler, a swipe changes day first (so you don't have to scroll
      // back up to the day tabs) - it only falls through to switching the 보관장소/지도
      // tab once you're already at the first/last day, same as before.
      if (mobileActiveView === 'SCHEDULER') {
        const sortedDays = [...dayItinerariesRef.current].sort((a, b) => a.dayIndex - b.dayIndex);
        const dayPos = sortedDays.findIndex((d) => d.dayIndex === activeDayIndexRef.current);
        const nextDay = sortedDays[dayPos + (deltaX < 0 ? 1 : -1)];
        if (nextDay) {
          setActiveDayIndex(nextDay.dayIndex);
          // Otherwise the new day renders wherever the previous day happened to be
          // scrolled to, which can hide its first cards below the fold.
          document.getElementById('app-root')?.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      const currentIndex = MOBILE_VIEW_ORDER.indexOf(mobileActiveView);
      const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= MOBILE_VIEW_ORDER.length) return;

      setMobileActiveView(MOBILE_VIEW_ORDER[nextIndex]);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [mobileActiveView]);

  // Last trip stamp (id + updated_at) this tab has synced to, used by the poller below
  const lastSeenStampRef = React.useRef<string | null>(null);
  const reloadFromDbRef = React.useRef<null | (() => Promise<void>)>(null);

  // Auto-sync / load latest real trip and places from Supabase on mount
  useEffect(() => {
    let isMounted = true;

    async function autoLoadFromSupabase() {
      if (!isMounted) return;
      if (!isSupabaseConfigured()) {
        if (isMounted) setIsDbInitialLoaded(true);
        return;
      }
      try {
        // Always load the most recently updated trip across devices
        const result = await fetchLatestTripFromSupabase();
        if (!isMounted) return;

        // Remember what we just synced to, so the poller only reloads on NEW changes
        lastSeenStampRef.current = await fetchLatestTripStamp();

        if (result.status === 'loaded') {
          const loaded = result.payload;
          // This state came from the DB — don't let the auto-save effect write it back.
          skipNextAutoSaveRef.current = true;
          setActiveTrip?.(loaded.tripId, loaded.title);
          loadFullTripState?.({
            tripId: loaded.tripId,
            title: loaded.title,
            startDate: loaded.startDate || '2026-08-16',
            dayCount: loaded.dayCount || 3,
            places: loaded.places || [],
            scheduledPlaces: loaded.scheduledPlaces || [],
            dayItineraries: loaded.dayItineraries || [],
          });
          // Local state now mirrors the DB, so arming auto-save is safe.
          setIsDbInitialLoaded(true);
        } else if (result.status === 'empty') {
          // No trip exists yet — nothing to overwrite, so a first-time user can save.
          setIsDbInitialLoaded(true);
        } else {
          // The load FAILED. Local state here is the empty default; saving it would
          // DELETE every row of a trip that does exist in the DB. Leave auto-save
          // disarmed — a read-only tab is the safe failure mode, silent data loss is not.
          console.error('❌ [DB 불러오기 실패]: 자동저장을 중단합니다 (기존 데이터 보호).', result.message);
          setAutoSaveStatus('error');
        }
      } catch (e) {
        // Same reasoning: never arm auto-save after a failed load.
        console.error('❌ [DB 불러오기 예외]: 자동저장을 중단합니다 (기존 데이터 보호).', e);
        if (isMounted) setAutoSaveStatus('error');
      }
    }

    autoLoadFromSupabase();
    reloadFromDbRef.current = autoLoadFromSupabase;

    // Subscribe to Supabase Realtime changes across devices
    let unsubscribe: any = null;
    if (isSupabaseConfigured()) {
      try {
        // ignoreSelfWrites: this handler reloads trip state, so reacting to our own
        // save would re-trigger the auto-save effect and race the next save.
        unsubscribe = subscribeToTripChanges(
          () => {
            if (isMounted) {
              autoLoadFromSupabase();
            }
          },
          { ignoreSelfWrites: true }
        );
      } catch (e) {
        console.warn('Realtime subscription setup failed:', e);
      }
    }

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch (e) {}
      }
    };
  }, []);

  // Auto-Save: push every change to Supabase immediately so any device that opens the
  // site sees it right away. Kept just long enough to coalesce a burst of keystrokes
  // into one write; saves are serialized in lib/supabase.ts so they cannot interleave.
  const AUTO_SAVE_DELAY_MS = 150;

  // Set before every loadFullTripState from the DB. State that came FROM the database
  // must not be written straight back to it: with realtime sync that echo would make two
  // open devices save to each other forever (A saves -> B reloads -> B saves -> A
  // reloads -> ...). Also covers the very first load, hence the initial `true`.
  const skipNextAutoSaveRef = React.useRef(true);

  // Latest payload, so a save can be flushed on tab hide without waiting for the timer
  const pendingSaveRef = React.useRef<any>(null);

  useEffect(() => {
    if (!isDbInitialLoaded || !isSupabaseConfigured()) return;

    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    const payload = {
      tripId: activeTripId || 'aa_trip_main',
      title: activeTripTitle || '스마트 여행 일정',
      startDate,
      dayCount,
      places,
      scheduledPlaces,
      dayItineraries,
    };
    pendingSaveRef.current = payload;

    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveTripToSupabase(payload);
        if (pendingSaveRef.current === payload) pendingSaveRef.current = null;
        // Our own save moved trips.updated_at. Record the new stamp, otherwise the
        // poller reads it as someone else's change and reloads — which would reset the
        // user's selected day mid-edit.
        lastSeenStampRef.current = await fetchLatestTripStamp();
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch (err) {
        console.warn('Auto save error:', err);
        setAutoSaveStatus('error');
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    places,
    scheduledPlaces,
    dayItineraries,
    startDate,
    dayCount,
    activeTripId,
    activeTripTitle,
    isDbInitialLoaded,
    setAutoSaveStatus,
  ]);

  // Cross-device sync fallback. Realtime is the fast path, but it only delivers events
  // if the tables are in the supabase_realtime publication — if they are not, sync fails
  // silently. Polling a one-row stamp guarantees another device's change shows up here
  // within a few seconds either way.
  useEffect(() => {
    if (!isDbInitialLoaded || !isSupabaseConfigured()) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      // Skip while our own write is in flight: the stamp would be ours, not a peer's.
      if (isSelfWriting()) return;

      const stamp = await fetchLatestTripStamp();
      if (cancelled || !stamp) return;

      if (lastSeenStampRef.current && stamp !== lastSeenStampRef.current) {
        lastSeenStampRef.current = stamp;
        await reloadFromDbRef.current?.();
      } else if (!lastSeenStampRef.current) {
        lastSeenStampRef.current = stamp;
      }
    };

    const timer = setInterval(check, 4000);
    // Also check the moment the tab is brought back into focus
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isDbInitialLoaded]);

  // Flush a pending save when the tab is hidden or closed. Without this, closing the tab
  // (or switching apps on mobile) within the debounce window drops the last change, and
  // another device would never see it.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const flush = () => {
      const payload = pendingSaveRef.current;
      if (!payload || !isSupabaseConfigured()) return;
      pendingSaveRef.current = null;
      saveTripToSupabase(payload)
        .then(async () => {
          lastSeenStampRef.current = await fetchLatestTripStamp();
        })
        .catch((e) => console.warn('Flush save error:', e));
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Seamless automatic background update of place operating hours
  useEffect(() => {
    let isMounted = true;

    async function autoUpdateOperatingHours() {
      if (!places || places?.length === 0) return;
      const outdatedPlaces = places?.filter(
        (p) =>
          !p?.operatingHours ||
          (p?.operatingHours?.open === '09:00' && p?.operatingHours?.close === '21:00') ||
          !p?.parkingText ||
          p?.parkingText === '주차 정보 없음'
      ) || [];

      if (outdatedPlaces?.length > 0 && isMounted) {
        const placeMap = new Map(places?.map((p) => [p?.id, p]));
        const chunkSize = 5;

        for (let i = 0; i < outdatedPlaces.length; i += chunkSize) {
          if (!isMounted) break;
          const chunk = outdatedPlaces.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (p) => {
              if (!p?.id) return;
              const cleanSid = p.id.replace(/^[^\d]+/, '').replace(/_\d+$/, '');
              if (/^\d+$/.test(cleanSid)) {
                try {
                  const res = await fetch(`/api/parse-naver?sid=${cleanSid}`);
                  if (res.ok && isMounted) {
                    const data = await res.json();
                    if (data?.success && data?.place) {
                      placeMap.set(p.id, {
                        ...p,
                        operatingHours: data.place.operatingHours || p.operatingHours,
                        isEveryday: data.place.isEveryday ?? p.isEveryday,
                        dayOffs: data.place.dayOffs || p.dayOffs,
                        dayOffRaw: data.place.dayOffRaw || p.dayOffRaw,
                        holiday_text: data.place.holiday_text || p.holiday_text,
                        hasParking: data.place.hasParking ?? p.hasParking,
                        parkingText: data.place.parkingText || p.parkingText,
                      });
                    }
                  }
                } catch (e) {
                  // Silent fail for background parser
                }
              }
            })
          );
        }

        if (isMounted) {
          addPlaces?.(Array.from(placeMap.values()));
        }
      }
    }

    autoUpdateOperatingHours();

    return () => {
      isMounted = false;
    };
  }, [places?.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragItem(active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Case 1: Dragged from Sidebar Place List into a Day Column or Scheduled Card
    if (activeData?.type === 'SIDEBAR_PLACE') {
      const place = activeData.place;
      let targetDayIndex = activeDayIndex;

      if (overData?.type === 'DAY_COLUMN') {
        targetDayIndex = overData.dayIndex;
      } else if (overData?.type === 'SCHEDULED_PLACE') {
        targetDayIndex = overData.scheduledPlace.dayIndex;
      }

      addPlaceToDay(place.id, targetDayIndex);
      return;
    }

    // Case 2: Reordering or moving an existing Scheduled Card
    if (activeData?.type === 'SCHEDULED_PLACE') {
      const activeSchedule = activeData.scheduledPlace;
      const activeScheduleId = activeSchedule.scheduleId;
      const sourceDayIndex = activeSchedule.dayIndex;

      if (overData?.type === 'DAY_COLUMN') {
        // Dropped on the column itself rather than a specific card (e.g. empty space
        // below the last card, now that the list can grow past the visible area) -
        // moveScheduleToDay handles the same-day case fine, placing it at the end.
        moveScheduleToDay(activeScheduleId, overData.dayIndex);
      } else if (overData?.type === 'SCHEDULED_PLACE') {
        const overSchedule = overData.scheduledPlace;
        const targetDayIndex = overSchedule.dayIndex;
        if (sourceDayIndex === targetDayIndex) {
          reorderDaySchedule(sourceDayIndex, activeScheduleId, overSchedule.scheduleId);
        } else {
          moveScheduleToDay(activeScheduleId, targetDayIndex);
        }
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div id="app-root" className="flex flex-col h-full min-h-screen w-screen bg-slate-100 overflow-y-auto pb-16 md:pb-0 md:h-screen md:overflow-hidden font-sans">
        {/* Top Navigation Header */}
        <Header />

        {/* Main Workspace Layout (Desktop Side-by-Side / Mobile Single View) */}
        <div
          ref={workspaceRef}
          className="flex-1 flex flex-col md:flex-row overflow-visible md:overflow-hidden relative md:min-h-0"
        >
          {/* Left Sidebar: Places Ingestion & Day-Off Filters */}
          <div className={`${mobileActiveView === 'PLACES' ? 'flex w-full' : 'hidden'} md:flex md:w-80 h-full shrink-0`}>
            <Sidebar />
          </div>

          {/* Center: Date-Aware Kanban Board Scheduler */}
          <div
            className={`${
              mobileActiveView === 'SCHEDULER' ? 'flex' : 'hidden'
            } md:flex ${
              mapViewState === 'MAXIMIZED' ? 'md:hidden' : 'flex-1'
            } h-auto md:h-full md:min-h-0 bg-slate-50 overflow-visible md:overflow-hidden flex-col transition-all duration-300`}
          >
            {/* In-Scheduler Trip Folder Tab Bar & Real-time Auto-Save Status */}
            <TripFolderTabs />

            <div className="flex-1 md:min-h-0 w-full overflow-visible md:overflow-hidden flex flex-col relative">
              <KanbanBoard />
            </div>
          </div>

          {/* Right: Naver Maps Container with Minimize / Maximize support */}
          <div
            className={`${
              mobileActiveView === 'MAP' ? 'flex w-full' : 'hidden'
            } md:flex ${
              mapViewState === 'MAXIMIZED'
                ? 'md:w-full'
                : mapViewState === 'MINIMIZED'
                ? 'md:w-12'
                : 'md:w-[45%]'
            } h-full transition-all duration-300 relative shrink-0`}
          >
            <NaverMapContainer
              mapViewState={mapViewState}
              setMapViewState={setMapViewState}
              isMobileVisible={mobileActiveView === 'MAP'}
            />
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar (< 768px) — fixed so it's always reachable even
            when the active view (e.g. 80+ archived places) scrolls far past one screen. */}
        <div className="md:hidden fixed bottom-0 inset-x-0 flex items-center justify-around bg-white border-t border-slate-200 py-2 px-3 shadow-lg z-30">
          <button
            onClick={() => setMobileActiveView('PLACES')}
            className={`flex flex-col items-center gap-1 min-h-[44px] justify-center px-4 py-1 rounded-xl text-xs font-black transition-all ${
              mobileActiveView === 'PLACES'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-5 h-5 text-emerald-600" />
            <span>보관 장소 ({places.length})</span>
          </button>

          <button
            onClick={() => setMobileActiveView('SCHEDULER')}
            className={`flex flex-col items-center gap-1 min-h-[44px] justify-center px-4 py-1 rounded-xl text-xs font-black transition-all ${
              mobileActiveView === 'SCHEDULER'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-5 h-5 text-emerald-600" />
            <span>스케줄러</span>
          </button>

          <button
            onClick={() => setMobileActiveView('MAP')}
            className={`flex flex-col items-center gap-1 min-h-[44px] justify-center px-4 py-1 rounded-xl text-xs font-black transition-all ${
              mobileActiveView === 'MAP'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <MapIcon className="w-5 h-5 text-emerald-600" />
            <span>네이버 지도</span>
          </button>
        </div>

        {/* Interactive Modals */}
        <DataIngestionModal />
        <ExportModal />
        <PlaceSearchModal />
        <SupabaseSyncModal />
        <FolderPasswordGate />

        {/* Floating Drag Overlay */}
        <DragOverlay>
          {activeDragItem?.type === 'SIDEBAR_PLACE' ? (
            <div className="w-72 shadow-2xl rounded-xl ring-2 ring-emerald-500 bg-white p-2">
              <PlaceCard place={activeDragItem.place} isDragOverlay />
            </div>
          ) : activeDragItem?.type === 'SCHEDULED_PLACE' ? (
            <div className="w-72 shadow-2xl rounded-xl ring-2 ring-emerald-500 bg-white p-2">
              <ScheduledCard
                scheduledPlace={activeDragItem.scheduledPlace}
                orderIndex={0}
                totalInDay={1}
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
