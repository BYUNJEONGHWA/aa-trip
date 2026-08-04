import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { addDays, format, parseISO } from 'date-fns';
import { Place, ScheduledPlace, DayItinerary, DayOfWeek } from './types';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bktbgmscczwbcquxbhda.supabase.co').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_5dYwS8jHx5Md4eqxCFyh3Q_Y_3y5USi').trim();

export const isSupabaseConfigured = (): boolean => {
  return (
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    supabaseUrl.startsWith('https://')
  );
};

// Singleton Supabase Client
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface SavedTripPayload {
  tripId: string;
  title: string;
  startDate: string;
  dayCount: number;
  places: Place[];
  scheduledPlaces: ScheduledPlace[];
  dayItineraries: DayItinerary[];
}

/**
 * Update trip title directly in Supabase DB
 */
export async function updateTripTitleInSupabase(tripId: string, title: string) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('trips')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', tripId);
  if (error) {
    console.warn('Update trip title error:', error.message);
    return false;
  }
  return true;
}

/**
 * Serializes saves. saveTripToSupabase is "DELETE all rows for this trip, then INSERT
 * the current set" — which is only correct if it never interleaves with itself. Two
 * concurrent saves run as DELETE, DELETE, INSERT, INSERT and leave EVERY schedule row
 * duplicated. (That is exactly how the schedule ended up with 8 rows / 4 schedule_ids.)
 * Concurrent callers are real: the debounced auto-save in app/page.tsx, the direct save
 * in store.updateDayNotes, and the realtime handler all fire independently.
 */
let saveChain: Promise<any> = Promise.resolve();

/**
 * Set while our own write is in flight, so the realtime subscription can ignore the
 * change events our own save produces instead of reloading and re-triggering a save.
 */
let selfWriteDepth = 0;
let lastSelfWriteEndedAt = 0;
// Change events lag the write that caused them, so keep ignoring them briefly after the
// save finishes. Kept SHORT: while this window is open a genuine change from ANOTHER
// device is also ignored, which would delay cross-device sync. The save->reload->save
// loop is prevented at the source in app/page.tsx (skipNextAutoSaveRef), so this only
// needs to cover the event-delivery lag of our own write.
const SELF_WRITE_ECHO_GRACE_MS = 400;
export const isSelfWriting = () =>
  selfWriteDepth > 0 || Date.now() - lastSelfWriteEndedAt < SELF_WRITE_ECHO_GRACE_MS;

/**
 * Save current trip & places state to Supabase.
 * Calls are queued so a save never overlaps another save.
 */
export async function saveTripToSupabase(payload: SavedTripPayload) {
  if (!supabase) {
    throw new Error('Supabase URL 및 Anon Key가 설정되지 않았습니다. .env.local 설정이 필요합니다.');
  }

  const run = saveChain.then(
    () => performSaveTripToSupabase(payload),
    () => performSaveTripToSupabase(payload)
  );
  // Keep the chain alive even if this save rejects, so later saves still run.
  saveChain = run.catch(() => {});
  return run;
}

async function performSaveTripToSupabase(payload: SavedTripPayload) {
  if (!supabase) throw new Error('Supabase 미설정');

  selfWriteDepth++;
  try {
    return await writeTripRows(payload);
  } finally {
    selfWriteDepth--;
    lastSelfWriteEndedAt = Date.now();
  }
}

async function writeTripRows(payload: SavedTripPayload) {
  if (!supabase) throw new Error('Supabase 미설정');

  const { tripId, title, startDate, dayCount, places, scheduledPlaces, dayItineraries } = payload;

  // 1. Upsert Trip record
  const { error: tripError } = await supabase.from('trips').upsert({
    id: tripId,
    title,
    start_date: startDate,
    day_count: dayCount,
    updated_at: new Date().toISOString(),
  });

  if (tripError) throw tripError;

  // 2. Upsert Places library (scoped by tripId)
  if (places.length > 0) {
    const placesData = places.map((p) => ({
      id: p.id,
      trip_id: tripId,
      name: p.name,
      category: p.category,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      operating_hours: p.operatingHours,
      is_everyday: p.isEveryday,
      day_offs: p.dayOffs,
      day_off_raw: p.dayOffRaw || null,
      holiday_text: p.holiday_text || null,
      off_rules: p.off_rules || [],
      has_parking: p.hasParking,
      parking_text: p.parkingText || null,
    }));

    const { error: placesError } = await supabase.from('places').upsert(placesData, { onConflict: 'id' });
    if (placesError) {
      console.error('❌ [DB 장소 저장 실패]:', placesError.message);
      throw placesError;
    }
  }

  // 3. Delete existing schedules for this trip & insert new schedules
  const { error: schedDeleteErr } = await supabase.from('scheduled_places').delete().eq('trip_id', tripId);
  if (schedDeleteErr) {
    console.error('❌ [DB 기존 일정 삭제 실패]:', schedDeleteErr.message);
    throw schedDeleteErr;
  }

  if (scheduledPlaces.length > 0) {
    const scheduledData = scheduledPlaces.map((s) => ({
      trip_id: tripId,
      schedule_id: s.scheduleId,
      place_id: s.placeId || null, // BREAK items carry no real place
      day_index: s.dayIndex,
      order_index: s.order,
      item_type: s.type || 'PLACE',
      break_label: s.breakLabel || null,
      break_duration_minutes: s.breakDurationMinutes ?? null,
    }));

    const { error: schedError } = await supabase.from('scheduled_places').insert(scheduledData);
    if (schedError) {
      console.error('❌ [DB 일정 저장 실패]:', schedError.message);
      throw schedError;
    }
  }

  // 4. Save Day Notes
  const { error: notesDeleteErr } = await supabase.from('day_itineraries').delete().eq('trip_id', tripId);
  if (notesDeleteErr) {
    console.error('❌ [DB 기존 메모 삭제 실패]:', notesDeleteErr.message);
    throw notesDeleteErr;
  }
  if (dayItineraries.length > 0) {
    const notesData = dayItineraries.map((it) => ({
      trip_id: tripId,
      day_index: it.dayIndex,
      date_str: it.dateStr,
      notes: it.notes || '',
    }));
    const { error: notesErr } = await supabase.from('day_itineraries').insert(notesData);
    if (notesErr) {
      console.error('❌ [DB 메모 저장 실패]:', notesErr.message);
      throw notesErr;
    }
  }

  console.log('💾 [DB 저장 성공]:', { tripId, title, placeCount: places.length, schedCount: scheduledPlaces.length });
  return { success: true, tripId };
}

/**
 * Load trip from Supabase by trip ID
 */
export async function loadTripFromSupabase(tripId: string): Promise<SavedTripPayload | null> {
  if (!supabase) return null;

  // 1. Fetch Trip info
  const { data: trip, error: tripErr } = await supabase.from('trips').select('*').eq('id', tripId).single();
  if (tripErr || !trip) return null;

  // 2. Fetch Places for THIS SPECIFIC TRIP
  const { data: placesData } = await supabase.from('places').select('*').eq('trip_id', tripId);
  const places: Place[] = (placesData || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category || '장소',
    address: p.address || '',
    lat: p.lat,
    lng: p.lng,
    hasParking: p.has_parking ?? p.hasParking ?? false,
    parkingText: p.parking_text || p.parkingText || (p.has_parking ? '주차 가능' : '주차 정보 없음'),
    operatingHours: p.operating_hours || { open: '00:00', close: '24:00', display: '영업시간' },
    isEveryday: p.is_everyday ?? true,
    dayOffs: p.day_offs || [],
    dayOffRaw: p.day_off_raw || '',
    holiday_text: p.holiday_text || '',
    off_rules: p.off_rules || [],
  }));

  // 3. Fetch Scheduled Places
  const { data: schedData } = await supabase
    .from('scheduled_places')
    .select('*')
    .eq('trip_id', tripId)
    .order('order_index', { ascending: true });

  // Collapse rows that share a schedule_id. A schedule_id is minted once per
  // addPlaceToDay call, so two rows carrying the same one are always the SAME entry
  // written twice by an interleaved save — never a place the user deliberately
  // scheduled twice (that would carry two different schedule_ids). Deduping here
  // heals already-corrupted data on load; the next save then persists the clean set.
  const seenScheduleIds = new Set<string>();
  const scheduledPlaces: ScheduledPlace[] = [];
  let duplicateRowCount = 0;

  (schedData || []).forEach((s: any) => {
    const scheduleId = s.schedule_id || `sched_${s.id}`;
    if (seenScheduleIds.has(scheduleId)) {
      duplicateRowCount++;
      return;
    }
    seenScheduleIds.add(scheduleId);
    scheduledPlaces.push({
      scheduleId,
      placeId: s.place_id || '',
      dayIndex: s.day_index,
      order: s.order_index,
      type: s.item_type === 'BREAK' ? 'BREAK' : 'PLACE',
      breakLabel: s.break_label || undefined,
      breakDurationMinutes: s.break_duration_minutes ?? undefined,
    });
  });

  if (duplicateRowCount > 0) {
    console.warn(`⚠️ [DB 중복 일정 ${duplicateRowCount}건 무시]: 동일 schedule_id 중복 행을 제거했습니다.`);
  }

  // 4. Fetch Day Notes
  const { data: daysData } = await supabase.from('day_itineraries').select('*').eq('trip_id', tripId);
  const notesMap: Record<number, string> = {};
  (daysData || []).forEach((d: any) => {
    notesMap[d.day_index] = d.notes || '';
  });

  const dayItineraries: DayItinerary[] = [];
  const baseDate = parseISO(trip.start_date || format(new Date(), 'yyyy-MM-dd'));
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

  for (let i = 0; i < (trip.day_count || 1); i++) {
    const currentDate = addDays(baseDate, i);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const weekday = WEEKDAYS[currentDate.getDay()];
    dayItineraries.push({
      dayIndex: i,
      title: `${i + 1}일차`,
      dateStr,
      weekday,
      weekdayLabel: KOREAN_WEEKDAYS[weekday],
      notes: notesMap[i] || '',
      scheduleIds: [],
    });
  }

  const resultPayload = {
    tripId: trip.id,
    title: trip.title || '여행 일정',
    startDate: trip.start_date,
    dayCount: trip.day_count,
    places,
    scheduledPlaces,
    dayItineraries,
  };

  console.log('📥 [DB 불러오기 성공]:', {
    tripId: trip.id,
    title: trip.title,
    placeCount: places.length,
    schedCount: scheduledPlaces.length,
  });

  return resultPayload;
}

/**
 * Fetch all saved trips list for dropdown selection
 */
export async function fetchAllTripsFromSupabase() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('trips').select('id, title, start_date, day_count, updated_at').order('updated_at', { ascending: false });
  if (error) {
    console.warn('Fetch trips error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Result of the initial load. The caller MUST be able to tell "there is genuinely no
 * trip yet" (safe to start saving) from "the query failed" (saving would overwrite a
 * trip that exists in the DB with empty local state).
 */
/**
 * Cheap "has anything changed?" probe: one row, two columns.
 * Realtime is the fast path for cross-device sync, but it only works if the tables are
 * in the supabase_realtime publication. Polling this stamp makes sync work regardless.
 */
export async function fetchLatestTripStamp(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return `${data[0].id}__${data[0].updated_at}`;
  } catch {
    return null;
  }
}

export type LatestTripResult =
  | { status: 'loaded'; payload: SavedTripPayload }
  | { status: 'empty' }
  | { status: 'error'; message: string };

/**
 * Fetch the single most recently updated trip state from Supabase
 */
export async function fetchLatestTripFromSupabase(): Promise<LatestTripResult> {
  if (!supabase) return { status: 'error', message: 'Supabase 미설정' };
  try {
    const { data: latestTrips, error } = await supabase
      .from('trips')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) return { status: 'error', message: error.message };
    if (!latestTrips || latestTrips.length === 0) return { status: 'empty' };

    const payload = await loadTripFromSupabase(latestTrips[0].id);
    if (!payload) {
      return { status: 'error', message: '여행 상세 조회 실패' };
    }
    return { status: 'loaded', payload };
  } catch (e: any) {
    console.warn('[Supabase] fetchLatestTripFromSupabase exception caught:', e);
    return { status: 'error', message: e?.message || String(e) };
  }
}

let realtimeChannelSeq = 0;

interface SubscribeOptions {
  /**
   * Skip events caused by this client's own save. Set for subscribers that RELOAD trip
   * state: without it every save echoes back as a change event -> reload -> new state ->
   * another save, and those overlapping saves are what duplicated the schedule rows.
   * Leave false for read-only subscribers (e.g. refreshing the trip list), which need to
   * see our own writes and cannot start a save loop.
   */
  ignoreSelfWrites?: boolean;
}

/**
 * Subscribe to real-time database changes across devices for instant sync
 */
export function subscribeToTripChanges(
  onRealtimeChange: () => void,
  { ignoreSelfWrites = false }: SubscribeOptions = {}
) {
  if (!supabase || typeof window === 'undefined') return () => {};

  const handleChange = () => {
    if (ignoreSelfWrites && isSelfWriting()) return;
    try { onRealtimeChange(); } catch (err) { console.warn('Realtime callback err:', err); }
  };

  try {
    // Unique per subscriber: two subscribers sharing one channel name clobber each
    // other when either unsubscribes via removeChannel.
    realtimeChannelSeq++;
    const channel = supabase
      .channel(`aa-trip-realtime-channel-${realtimeChannelSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        handleChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places' },
        handleChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_places' },
        handleChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_itineraries' },
        handleChange
      )
      .subscribe((status, err) => {
        // Without this callback a failed subscription is completely silent, and
        // cross-device sync just never happens with no way to tell why.
        if (status === 'SUBSCRIBED') {
          console.log('🔗 [실시간 동기화 연결됨]');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ [실시간 동기화 ${status}]`, err?.message || '');
        }
      });

    return () => {
      try {
        if (supabase && channel) {
          supabase.removeChannel(channel);
        }
      } catch (err) {
        console.warn('Realtime unsubscribe err:', err);
      }
    };
  } catch (err) {
    console.warn('[Supabase Realtime] Setup failed:', err);
    return () => {};
  }
}
