import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { addDays, format, parseISO } from 'date-fns';
import { Place, ScheduledPlace, DayItinerary, DayOfWeek } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    supabaseUrl !== 'your_supabase_url_here' &&
    supabaseAnonKey !== 'your_supabase_anon_key_here' &&
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
 * Save current trip & places state to Supabase
 */
export async function saveTripToSupabase(payload: SavedTripPayload) {
  if (!supabase) {
    throw new Error('Supabase URL 및 Anon Key가 설정되지 않았습니다. .env.local 설정이 필요합니다.');
  }

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

  // 2. Upsert Places library
  if (places.length > 0) {
    const placesData = places.map((p) => ({
      id: p.id,
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
    if (placesError) console.warn('Places upsert warn:', placesError.message);
  }

  // 3. Delete existing schedules for this trip & insert new schedules
  await supabase.from('scheduled_places').delete().eq('trip_id', tripId);

  if (scheduledPlaces.length > 0) {
    const scheduledData = scheduledPlaces.map((s) => ({
      trip_id: tripId,
      schedule_id: s.scheduleId,
      place_id: s.placeId,
      day_index: s.dayIndex,
      order_index: s.order,
    }));

    const { error: schedError } = await supabase.from('scheduled_places').insert(scheduledData);
    if (schedError) throw schedError;
  }

  // 4. Save Day Notes
  await supabase.from('day_itineraries').delete().eq('trip_id', tripId);
  if (dayItineraries.length > 0) {
    const notesData = dayItineraries.map((it) => ({
      trip_id: tripId,
      day_index: it.dayIndex,
      date_str: it.dateStr,
      notes: it.notes || '',
    }));
    await supabase.from('day_itineraries').insert(notesData);
  }

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

  // 2. Fetch Places
  const { data: placesData } = await supabase.from('places').select('*');
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

  const scheduledPlaces: ScheduledPlace[] = (schedData || []).map((s: any) => ({
    scheduleId: s.schedule_id || `sched_${s.id}`,
    placeId: s.place_id,
    dayIndex: s.day_index,
    order: s.order_index,
  }));

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

  return {
    tripId: trip.id,
    title: trip.title || '여행 일정',
    startDate: trip.start_date,
    dayCount: trip.day_count,
    places,
    scheduledPlaces,
    dayItineraries,
  };
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
