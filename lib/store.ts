import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, format, parseISO } from 'date-fns';
import { DayItinerary, DayOffFilter, DayOfWeek, Place, ScheduledPlace } from './types';
import { optimizeRouteOrder } from './routeOptimizer';
import { isSupabaseConfigured, saveTripToSupabase } from './supabase';

const WEEKDAYS: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KOREAN_WEEKDAYS: Record<DayOfWeek, string> = {
  Mon: '월요일',
  Tue: '화요일',
  Wed: '수요일',
  Thu: '목요일',
  Fri: '금요일',
  Sat: '토요일',
  Sun: '일요일',
};

interface AppState {
  places: Place[];
  filterDayOff: DayOffFilter;
  filterParkingOnly: boolean;
  searchQuery: string;
  selectedPlaceId: string | null;
  focusPlaceLocation: { lat: number; lng: number; timestamp: number } | null;

  activeTripId: string;
  activeTripTitle: string;
  startDate: string; // YYYY-MM-DD
  dayCount: number;
  dayItineraries: DayItinerary[];
  scheduledPlaces: ScheduledPlace[];

  activeDayIndex: number;
  isIngestModalOpen: boolean;
  isExportModalOpen: boolean;
  isSearchModalOpen: boolean;
  isSupabaseModalOpen: boolean;

  // Actions
  setActiveTrip: (tripId: string, title: string) => void;
  setFilterDayOff: (filter: DayOffFilter) => void;
  setFilterParkingOnly: (val: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedPlaceId: (id: string | null) => void;
  setFocusPlaceLocation: (loc: { lat: number; lng: number; timestamp: number } | null) => void;
  setStartDate: (dateStr: string) => void;
  updateDayDate: (dayIndex: number, newDateStr: string) => void;
  setDayCount: (count: number) => void;
  addDay: () => void;
  removeDay: (dayIndex: number) => void;

  addPlaces: (newPlaces: Place[]) => void;
  removePlace: (placeId: string) => void;

  addPlaceToDay: (placeId: string, dayIndex: number) => void;
  removeScheduledPlace: (scheduleId: string) => void;
  reorderDaySchedule: (dayIndex: number, activeScheduleId: string, overScheduleId: string) => void;
  moveScheduleToDay: (scheduleId: string, targetDayIndex: number) => void;

  optimizeDayRoute: (dayIndex: number) => void;
  updateDayNotes: (dayIndex: number, notes: string) => void;
  setActiveDayIndex: (idx: number) => void;
  setIsIngestModalOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;
  setIsSearchModalOpen: (open: boolean) => void;
  setIsSupabaseModalOpen: (open: boolean) => void;
  loadFullTripState: (payload: {
    tripId?: string;
    title?: string;
    startDate: string;
    dayCount: number;
    places: Place[];
    scheduledPlaces: ScheduledPlace[];
    dayItineraries?: DayItinerary[];
  }) => void;
}

const buildDayItineraries = (startDateStr: string, count: number, existingNotes: Record<number, string> = {}): DayItinerary[] => {
  const itineraries: DayItinerary[] = [];
  const baseDate = parseISO(startDateStr || format(new Date(), 'yyyy-MM-dd'));

  for (let i = 0; i < count; i++) {
    const currentDate = addDays(baseDate, i);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayOfWeekIndex = currentDate.getDay(); // 0 = Sun
    const weekday = WEEKDAYS[dayOfWeekIndex];
    const weekdayLabel = KOREAN_WEEKDAYS[weekday];

    itineraries.push({
      dayIndex: i,
      title: `${i + 1}일차`,
      dateStr,
      weekday,
      weekdayLabel,
      notes: existingNotes[i] || '',
      scheduleIds: [],
    });
  }
  return itineraries;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const initialStartDate = format(new Date(), 'yyyy-MM-dd');
      const initialDayCount = 1;
      const initialItineraries = buildDayItineraries(initialStartDate, initialDayCount);

      return {
        places: [],
        filterDayOff: 'ALL',
        filterParkingOnly: false,
        searchQuery: '',
        selectedPlaceId: null,
        focusPlaceLocation: null,

        activeTripId: 'aa_trip_main',
        activeTripTitle: '스마트 광주 여행',
        startDate: initialStartDate,
        dayCount: initialDayCount,
        dayItineraries: initialItineraries,
        scheduledPlaces: [],

        activeDayIndex: 0,
        isIngestModalOpen: false,
        isExportModalOpen: false,
        isSearchModalOpen: false,
        isSupabaseModalOpen: false,

        setActiveTrip: (tripId, title) => set({ activeTripId: tripId, activeTripTitle: title }),
        setFilterDayOff: (filter) => set({ filterDayOff: filter }),
        setFilterParkingOnly: (val) => set({ filterParkingOnly: val }),
        setSearchQuery: (query) => set({ searchQuery: query }),
        setSelectedPlaceId: (id) => set({ selectedPlaceId: id }),
        setFocusPlaceLocation: (loc) => set({ focusPlaceLocation: loc }),

        setStartDate: (dateStr) => {
          const state = get();
          const notesMap: Record<number, string> = {};
          state.dayItineraries.forEach((it) => {
            notesMap[it.dayIndex] = it.notes;
          });
          const newItineraries = buildDayItineraries(dateStr, state.dayCount, notesMap);
          set({ startDate: dateStr, dayItineraries: newItineraries });
        },

        updateDayDate: (dayIndex, newDateStr) => {
          set((state) => {
            try {
              const parsedDate = parseISO(newDateStr);
              const dayOfWeekIndex = parsedDate.getDay(); // 0 = Sun
              const weekday = WEEKDAYS[dayOfWeekIndex];
              const weekdayLabel = KOREAN_WEEKDAYS[weekday];

              const updatedItineraries = state.dayItineraries.map((it) =>
                it.dayIndex === dayIndex
                  ? { ...it, dateStr: newDateStr, weekday, weekdayLabel }
                  : it
              );

              const isCurrentActive = state.activeDayIndex === dayIndex;
              return {
                dayItineraries: updatedItineraries,
                filterDayOff: isCurrentActive ? weekday : state.filterDayOff,
              };
            } catch (e) {
              return state;
            }
          });
        },

        setDayCount: (count) => {
          const state = get();
          const newCount = Math.max(1, Math.min(14, count));
          const notesMap: Record<number, string> = {};
          state.dayItineraries.forEach((it) => {
            notesMap[it.dayIndex] = it.notes;
          });
          const newItineraries = buildDayItineraries(state.startDate, newCount, notesMap);
          set({ dayCount: newCount, dayItineraries: newItineraries });
        },

        addDay: () => {
          const state = get();
          state.setDayCount(state.dayCount + 1);
        },

        removeDay: (dayIndex) => {
          const state = get();
          if (state.dayCount <= 1) return;
          const updatedScheduled = state.scheduledPlaces.filter((s) => s.dayIndex !== dayIndex);
          const reindexedScheduled = updatedScheduled.map((s) => ({
            ...s,
            dayIndex: s.dayIndex > dayIndex ? s.dayIndex - 1 : s.dayIndex,
          }));
          set({ dayCount: state.dayCount - 1 });
          state.setDayCount(state.dayCount - 1);
          set({ scheduledPlaces: reindexedScheduled });
        },

        addPlaces: (newPlaces) =>
          set((state) => {
            const placeMap = new Map<string, Place>();
            // Add existing places
            state.places.forEach((p) => placeMap.set(p.id, p));
            // Overwrite/update with new places
            newPlaces.forEach((p) => {
              const existing = placeMap.get(p.id);
              placeMap.set(p.id, existing ? { ...existing, ...p } : p);
            });
            return {
              places: Array.from(placeMap.values()),
            };
          }),

        removePlace: (placeId) =>
          set((state) => ({
            places: state.places.filter((p) => p.id !== placeId),
            scheduledPlaces: state.scheduledPlaces.filter((s) => s.placeId !== placeId),
          })),

        addPlaceToDay: (placeId, dayIndex) => {
          set((state) => {
            const dayItems = state.scheduledPlaces.filter((s) => s.dayIndex === dayIndex);
            const newSchedule: ScheduledPlace = {
              scheduleId: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              placeId,
              dayIndex,
              order: dayItems.length,
            };
            return {
              scheduledPlaces: [...state.scheduledPlaces, newSchedule],
              activeDayIndex: dayIndex,
            };
          });
        },

        removeScheduledPlace: (scheduleId) => {
          set((state) => ({
            scheduledPlaces: state.scheduledPlaces.filter((s) => s.scheduleId !== scheduleId),
          }));
        },

        reorderDaySchedule: (dayIndex, activeScheduleId, overScheduleId) => {
          set((state) => {
            const daySchedules = state.scheduledPlaces
              .filter((s) => s.dayIndex === dayIndex)
              .sort((a, b) => a.order - b.order);

            const oldIdx = daySchedules.findIndex((s) => s.scheduleId === activeScheduleId);
            const newIdx = daySchedules.findIndex((s) => s.scheduleId === overScheduleId);

            if (oldIdx === -1 || newIdx === -1) return state;

            const updatedDaySchedules = [...daySchedules];
            const [movedItem] = updatedDaySchedules.splice(oldIdx, 1);
            updatedDaySchedules.splice(newIdx, 0, movedItem);

            const reorderedWithOrder = updatedDaySchedules.map((item, index) => ({
              ...item,
              order: index,
            }));

            const otherDaySchedules = state.scheduledPlaces.filter((s) => s.dayIndex !== dayIndex);

            return {
              scheduledPlaces: [...otherDaySchedules, ...reorderedWithOrder],
            };
          });
        },

        moveScheduleToDay: (scheduleId, targetDayIndex) => {
          set((state) => {
            const item = state.scheduledPlaces.find((s) => s.scheduleId === scheduleId);
            if (!item) return state;

            const otherDaySchedules = state.scheduledPlaces.filter(
              (s) => s.scheduleId !== scheduleId && s.dayIndex === targetDayIndex
            );

            const updatedItem: ScheduledPlace = {
              ...item,
              dayIndex: targetDayIndex,
              order: otherDaySchedules.length,
            };

            const restOfSchedules = state.scheduledPlaces.filter((s) => s.scheduleId !== scheduleId);

            return {
              scheduledPlaces: [...restOfSchedules, updatedItem],
              activeDayIndex: targetDayIndex,
            };
          });
        },

        optimizeDayRoute: (dayIndex) => {
          const state = get();
          const placeMap = new Map(state.places.map((p) => [p.id, p]));
          const daySchedules = state.scheduledPlaces.filter((s) => s.dayIndex === dayIndex);

          if (daySchedules.length <= 1) return;

          const optimized = optimizeRouteOrder(daySchedules, placeMap);
          const otherSchedules = state.scheduledPlaces.filter((s) => s.dayIndex !== dayIndex);

          set({
            scheduledPlaces: [...otherSchedules, ...optimized],
          });
        },

        updateDayNotes: (dayIndex, notes) => {
          set((state) => {
            const updatedItineraries = state.dayItineraries.map((it) =>
              it.dayIndex === dayIndex ? { ...it, notes } : it
            );

            // Auto-sync notes to Supabase if configured
            if (isSupabaseConfigured()) {
              saveTripToSupabase({
                tripId: state.activeTripId,
                title: state.activeTripTitle,
                startDate: state.startDate,
                dayCount: state.dayCount,
                places: state.places,
                scheduledPlaces: state.scheduledPlaces,
                dayItineraries: updatedItineraries,
              }).catch((e) => console.warn('Auto sync notes warn:', e));
            }

            return { dayItineraries: updatedItineraries };
          });
        },

        setActiveDayIndex: (idx) => {
          const state = get();
          const targetItinerary = state.dayItineraries.find((it) => it.dayIndex === idx);
          const newFilter: DayOffFilter = targetItinerary?.weekday || 'ALL';
          set({ activeDayIndex: idx, filterDayOff: newFilter });
        },

        setIsIngestModalOpen: (open) => set({ isIngestModalOpen: open }),
        setIsExportModalOpen: (open) => set({ isExportModalOpen: open }),
        setIsSearchModalOpen: (open) => set({ isSearchModalOpen: open }),
        setIsSupabaseModalOpen: (open) => set({ isSupabaseModalOpen: open }),

        loadFullTripState: ({ tripId, title, startDate, dayCount, places, scheduledPlaces, dayItineraries }) => {
          const state = get();
          const notesMap: Record<number, string> = {};

          // 1. Preserve notes passed from payload (e.g. Supabase DB)
          if (dayItineraries && dayItineraries.length > 0) {
            dayItineraries.forEach((it) => {
              notesMap[it.dayIndex] = it.notes || '';
            });
          }

          // 2. Fall back to existing state/localStorage notes if payload notes were empty
          state.dayItineraries.forEach((it) => {
            if (notesMap[it.dayIndex] === undefined || notesMap[it.dayIndex] === '') {
              if (it.notes) notesMap[it.dayIndex] = it.notes;
            }
          });

          const newItineraries = buildDayItineraries(startDate, dayCount, notesMap);
          set({
            ...(tripId ? { activeTripId: tripId } : {}),
            ...(title ? { activeTripTitle: title } : {}),
            startDate,
            dayCount,
            places: places || [],
            scheduledPlaces: scheduledPlaces || [],
            dayItineraries: newItineraries,
            activeDayIndex: 0,
          });
        },
      };
    },
    {
      name: 'aa-trip-planner-storage',
      partialize: (state) => ({
        activeTripId: state.activeTripId,
        activeTripTitle: state.activeTripTitle,
        places: state.places,
        startDate: state.startDate,
        dayCount: state.dayCount,
        scheduledPlaces: state.scheduledPlaces,
        dayItineraries: state.dayItineraries,
      }),
    }
  )
);
