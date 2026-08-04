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
import PlaceCard from '@/components/PlaceCard';
import ScheduledCard from '@/components/Scheduler/ScheduledCard';
import { useAppStore } from '@/lib/store';
import {
  isSupabaseConfigured,
  fetchAllTripsFromSupabase,
  loadTripFromSupabase,
  fetchLatestTripFromSupabase,
  subscribeToTripChanges,
  saveTripToSupabase,
} from '@/lib/supabase';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  rectIntersection,
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
        const loaded = await fetchLatestTripFromSupabase();
        if (loaded && isMounted) {
          setActiveTrip?.(loaded?.tripId, loaded?.title);
          loadFullTripState?.({
            tripId: loaded?.tripId,
            title: loaded?.title,
            startDate: loaded?.startDate || '2026-08-16',
            dayCount: loaded?.dayCount || 3,
            places: loaded?.places || [],
            scheduledPlaces: loaded?.scheduledPlaces || [],
            dayItineraries: loaded?.dayItineraries || [],
          });
        }
      } catch (e) {
        console.warn('Auto load from Supabase failed:', e);
      } finally {
        if (isMounted) {
          setIsDbInitialLoaded(true);
        }
      }
    }

    autoLoadFromSupabase();

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

  // Debounced Auto-Save Effect: Auto save to Supabase whenever places, schedules, notes, or dates change
  const isFirstAutoSaveRun = React.useRef(true);

  useEffect(() => {
    if (!isDbInitialLoaded || !isSupabaseConfigured()) return;

    if (isFirstAutoSaveRun.current) {
      isFirstAutoSaveRun.current = false;
      return;
    }

    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveTripToSupabase({
          tripId: activeTripId || 'aa_trip_main',
          title: activeTripTitle || '스마트 여행 일정',
          startDate,
          dayCount,
          places,
          scheduledPlaces,
          dayItineraries,
        });
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch (err) {
        console.warn('Auto save error:', err);
        setAutoSaveStatus('error');
      }
    }, 1000);

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
        const targetDayIndex = overData.dayIndex;
        if (sourceDayIndex !== targetDayIndex) {
          moveScheduleToDay(activeScheduleId, targetDayIndex);
        }
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
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full min-h-screen w-screen bg-slate-100 overflow-y-auto md:h-screen md:overflow-hidden font-sans">
        {/* Top Navigation Header */}
        <Header />

        {/* Main Workspace Layout (Desktop Side-by-Side / Mobile Single View) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative min-h-0">
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
            } h-full min-h-0 bg-slate-50 overflow-hidden flex-col transition-all duration-300`}
          >
            {/* In-Scheduler Trip Folder Tab Bar & Real-time Auto-Save Status */}
            <TripFolderTabs />

            <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col relative">
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

        {/* Mobile Bottom Navigation Bar (< 768px) */}
        <div className="md:hidden flex items-center justify-around bg-white border-t border-slate-200 py-2 px-3 shadow-lg z-30 shrink-0">
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
