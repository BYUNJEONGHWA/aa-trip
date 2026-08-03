-- =========================================================================
--  Smart Trip Planner (스마트 여행 플래너) - Supabase PostgreSQL Schema DDL
--  Execute this script in Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Create Trips Table
CREATE TABLE IF NOT EXISTS public.trips (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '스마트 여행 일정',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    day_count INT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Places Library Table
CREATE TABLE IF NOT EXISTS public.places (
    id TEXT PRIMARY KEY,
    trip_id TEXT REFERENCES public.trips(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '장소',
    address TEXT DEFAULT '',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    operating_hours JSONB DEFAULT '{"open":"00:00","close":"24:00","display":"영업시간"}'::jsonb,
    is_everyday BOOLEAN DEFAULT TRUE,
    day_offs JSONB DEFAULT '[]'::jsonb,
    day_off_raw TEXT DEFAULT '',
    holiday_text TEXT DEFAULT '',
    off_rules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure trip_id exists even on existing tables
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS trip_id TEXT REFERENCES public.trips(id) ON DELETE CASCADE;

-- 3. Create Scheduled Places Table
CREATE TABLE IF NOT EXISTS public.scheduled_places (
    id BIGSERIAL PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    trip_id TEXT NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    place_id TEXT NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
    day_index INT NOT NULL DEFAULT 0,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Day Itineraries & Notes Table
CREATE TABLE IF NOT EXISTS public.day_itineraries (
    id BIGSERIAL PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    day_index INT NOT NULL DEFAULT 0,
    date_str DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS) & Set Public Access Policies
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_itineraries ENABLE ROW LEVEL SECURITY;

-- Allow Public Read/Write Access (Anon Role) for smooth demonstration
CREATE POLICY "Allow public all access on trips" ON public.trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on places" ON public.places FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on scheduled_places" ON public.scheduled_places FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on day_itineraries" ON public.day_itineraries FOR ALL USING (true) WITH CHECK (true);

-- 6. Indexes for High Performance Queries
CREATE INDEX IF NOT EXISTS idx_places_trip_id ON public.places(trip_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_places_trip_id ON public.scheduled_places(trip_id);
CREATE INDEX IF NOT EXISTS idx_day_itineraries_trip_id ON public.day_itineraries(trip_id);

-- 7. Enable Supabase Realtime for instant multi-device syncing
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.places;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_places;
ALTER PUBLICATION supabase_realtime ADD TABLE public.day_itineraries;
