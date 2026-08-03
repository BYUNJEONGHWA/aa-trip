'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  isSupabaseConfigured,
  saveTripToSupabase,
  fetchAllTripsFromSupabase,
  loadTripFromSupabase,
} from '@/lib/supabase';
import {
  Database,
  X,
  Save,
  Download,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Server,
  Calendar,
  Layers,
} from 'lucide-react';

export default function SupabaseSyncModal() {
  const {
    isSupabaseModalOpen,
    setIsSupabaseModalOpen,
    places,
    scheduledPlaces,
    dayItineraries,
    startDate,
    dayCount,
    loadFullTripState,
  } = useAppStore();

  const [isConfigured, setIsConfigured] = useState(false);
  const [tripTitle, setTripTitle] = useState('스마트 광주/전남 여행');
  const [savedTrips, setSavedTrips] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());
  }, [isSupabaseModalOpen]);

  const handleRefreshTrips = async () => {
    if (!isConfigured) return;
    setIsLoadingTrips(true);
    try {
      const trips = await fetchAllTripsFromSupabase();
      setSavedTrips(trips);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoadingTrips(false);
    }
  };

  useEffect(() => {
    if (isSupabaseModalOpen && isConfigured) {
      handleRefreshTrips();
    }
  }, [isSupabaseModalOpen, isConfigured]);

  if (!isSupabaseModalOpen) return null;

  const handleSaveToSupabase = async () => {
    if (!isConfigured) {
      setStatusMsg({
        type: 'error',
        text: '.env.local 파일에 Supabase URL과 Anon Key 설정이 필요합니다.',
      });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);

    try {
      const tripId = `trip_${Date.now()}`;
      await saveTripToSupabase({
        tripId,
        title: tripTitle.trim() || '스마트 여행 일정',
        startDate,
        dayCount,
        places,
        scheduledPlaces,
        dayItineraries,
      });

      setStatusMsg({
        type: 'success',
        text: `수파베이스 DB에 일정 저장 완료! (Trip ID: ${tripId})`,
      });
      handleRefreshTrips();
    } catch (err: any) {
      console.error('Supabase save error:', err);
      setStatusMsg({
        type: 'error',
        text: `저장 실패: ${err.message || 'Supabase 테이블 DDL 생성이 필요할 수 있습니다.'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadTrip = async (id: string) => {
    try {
      setIsLoadingTrips(true);
      const loaded = await loadTripFromSupabase(id);
      if (loaded) {
        loadFullTripState({
          startDate: loaded.startDate,
          dayCount: loaded.dayCount,
          places: loaded.places,
          scheduledPlaces: loaded.scheduledPlaces,
        });
        setStatusMsg({
          type: 'success',
          text: `'${loaded.title}' 일정을 수파베이스 DB에서 성공적으로 불러왔습니다!`,
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `불러오기 실패: ${err.message}`,
      });
    } finally {
      setIsLoadingTrips(false);
    }
  };

  const sqlSchemaCode = `-- Supabase DDL SQL Schema Script
CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, title TEXT, start_date DATE, day_count INT, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, name TEXT, category TEXT, address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, operating_hours JSONB, is_everyday BOOLEAN, day_offs JSONB, day_off_raw TEXT, holiday_text TEXT, off_rules JSONB, has_parking BOOLEAN DEFAULT FALSE, parking_text TEXT);
CREATE TABLE IF NOT EXISTS scheduled_places (id BIGSERIAL PRIMARY KEY, schedule_id TEXT, trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE, place_id TEXT REFERENCES places(id) ON DELETE CASCADE, day_index INT, order_index INT);
CREATE TABLE IF NOT EXISTS day_itineraries (id BIGSERIAL PRIMARY KEY, trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE, day_index INT, date_str DATE, notes TEXT);

-- Migration for existing places table
ALTER TABLE places ADD COLUMN IF NOT EXISTS has_parking BOOLEAN DEFAULT FALSE;
ALTER TABLE places ADD COLUMN IF NOT EXISTS parking_text TEXT;

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_itineraries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access on trips" ON trips;
DROP POLICY IF EXISTS "Allow public all access on places" ON places;
DROP POLICY IF EXISTS "Allow public all access on scheduled_places" ON scheduled_places;
DROP POLICY IF EXISTS "Allow public all access on day_itineraries" ON day_itineraries;

CREATE POLICY "Allow public all access on trips" ON trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on places" ON places FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on scheduled_places" ON scheduled_places FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on day_itineraries" ON day_itineraries FOR ALL USING (true) WITH CHECK (true);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSchemaCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black shadow-md shadow-emerald-600/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Supabase (수파베이스) DB 연동 &amp; 데이터 동기화
                </h3>
                <span
                  className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${
                    isConfigured
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {isConfigured ? '🟢 DB 연결 준비됨' : '🟠 환경변수 설정 필요'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                클라우드 PostgreSQL 데이터베이스에 여행 장소 &amp; 요일별 일정을 안전하게 저장 및 동기화합니다.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSupabaseModalOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto max-h-[500px] space-y-5 bg-slate-50/50">
          {/* Status Message Banner */}
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Section 1: Save Current Trip to Supabase */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Save className="w-4 h-4 text-emerald-600" />
              <span>현재 여행 일정 수파베이스 DB에 저장하기</span>
            </h4>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                placeholder="여행 일정 제목 입력 (예: 2026 광주 맛집 &amp; 명소 여행)"
                className="flex-1 px-3 py-2 bg-slate-50 text-xs font-bold text-slate-900 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleSaveToSupabase}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md shadow-emerald-600/20 flex items-center gap-1.5 shrink-0 transition-all"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>DB에 일정 저장</span>
              </button>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium pt-1">
              <span>📍 장소: <strong>{places.length}곳</strong></span>
              <span>📅 일정: <strong>{dayCount}일 동안 ({scheduledPlaces.length}개 배치)</strong></span>
              <span>🗓️ 시작일: <strong>{startDate}</strong></span>
            </div>
          </div>

          {/* Section 2: Load Saved Trips from Supabase */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-blue-600" />
                <span>저장된 여행 일정 목록 불러오기</span>
              </h4>
              <button
                onClick={handleRefreshTrips}
                disabled={isLoadingTrips}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingTrips ? 'animate-spin' : ''}`} />
                <span>새로고침</span>
              </button>
            </div>

            {savedTrips.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                {isConfigured ? '수파베이스 DB에 저장된 일정이 없습니다.' : '수파베이스 환경변수 설정 후 목록이 표출됩니다.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {savedTrips.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2 hover:bg-slate-100/80 transition-colors"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">{t.title}</h5>
                      <span className="text-[10px] text-slate-400">
                        {t.start_date} 시작 ({t.day_count}일) • {new Date(t.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={() => handleLoadTrip(t.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded shadow-2xs transition-all"
                    >
                      불러오기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Supabase SQL Setup Schema Code */}
          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Server className="w-4 h-4" />
                <span>Supabase SQL 테이블 생성 DDL 스크립트</span>
              </span>

              <button
                onClick={copySqlToClipboard}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold border border-slate-700 flex items-center gap-1 transition-all"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>SQL 스크립트 복사</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Supabase Dashboard -&gt; SQL Editor에 복사하여 실행하시면 테이블 구조가 자동 생성됩니다.
            </p>

            <pre className="p-3 bg-slate-950 rounded-lg text-[10px] text-slate-300 font-mono overflow-x-auto border border-slate-800 max-h-32">
              {sqlSchemaCode}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px] text-slate-500 font-medium">
            ENV: {isConfigured ? '🟢 SUPABASE OK' : '🟠 .env.local 설정 대기 중'}
          </span>

          <button
            onClick={() => setIsSupabaseModalOpen(false)}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
