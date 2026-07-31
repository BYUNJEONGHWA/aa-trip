'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  fetchAllTripsFromSupabase,
  loadTripFromSupabase,
  saveTripToSupabase,
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabase';
import { Folder, Plus, Trash2, CheckCircle2, RefreshCw, Edit2, Check, X } from 'lucide-react';

export default function TripFolderTabs() {
  const {
    activeTripId,
    activeTripTitle,
    setActiveTrip,
    places,
    scheduledPlaces,
    dayItineraries,
    startDate,
    dayCount,
    loadFullTripState,
  } = useAppStore();

  const [trips, setTrips] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Inline Folder Rename state
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

  // Fetch all trips from Supabase DB on mount or when activeTripId changes
  const loadTripsList = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const list = await fetchAllTripsFromSupabase();
      setTrips(list);
    } catch (e) {
      console.warn('Load trips error:', e);
    }
  };

  useEffect(() => {
    loadTripsList();
  }, [activeTripId]);

  // Debounced Real-time Auto-Save to Supabase DB
  useEffect(() => {
    if (!isSupabaseConfigured() || places.length === 0) return;

    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveTripToSupabase({
          tripId: activeTripId,
          title: activeTripTitle || '스마트 여행',
          startDate,
          dayCount,
          places,
          scheduledPlaces,
          dayItineraries,
        });
        setAutoSaveStatus('saved');
        loadTripsList();
      } catch (e) {
        console.warn('Auto save error:', e);
        setAutoSaveStatus('idle');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [places, scheduledPlaces, dayItineraries, startDate, dayCount, activeTripId, activeTripTitle]);

  // Switch Active Trip Folder
  const handleSelectTrip = async (trip: any) => {
    if (editingTripId) return; // Ignore switch if currently editing
    if (trip.id === activeTripId) return;

    try {
      const loaded = await loadTripFromSupabase(trip.id);
      const targetTitle = loaded?.title || trip.title || '여행 일정';
      setActiveTrip(trip.id, targetTitle);

      if (loaded) {
        loadFullTripState({
          tripId: trip.id,
          title: targetTitle,
          startDate: loaded.startDate || '2026-08-16',
          dayCount: loaded.dayCount || 3,
          places: loaded.places || [],
          scheduledPlaces: loaded.scheduledPlaces || [],
          dayItineraries: loaded.dayItineraries || [],
        });
      }
    } catch (e) {
      console.warn('Load trip failed:', e);
    }
  };

  // Create New Trip Folder
  const handleCreateTrip = async () => {
    const title = newTitle.trim();
    if (!title) return;

    const newTripId = `trip_${Date.now()}`;
    try {
      await saveTripToSupabase({
        tripId: newTripId,
        title,
        startDate: '2026-08-16',
        dayCount: 3,
        places: [],
        scheduledPlaces: [],
        dayItineraries: [],
      });

      setActiveTrip(newTripId, title);
      loadFullTripState({
        tripId: newTripId,
        title,
        startDate: '2026-08-16',
        dayCount: 3,
        places: [],
        scheduledPlaces: [],
      });

      setNewTitle('');
      setIsCreating(false);
      await loadTripsList();
    } catch (e) {
      console.warn('Create trip error:', e);
    }
  };

  // Rename Trip Folder
  const startRenameTrip = (tripId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTripId(tripId);
    setEditingTitle(currentTitle);
  };

  const handleSaveRename = async (tripId: string) => {
    const title = editingTitle.trim();
    if (!title) {
      setEditingTripId(null);
      return;
    }

    try {
      if (tripId === activeTripId) {
        setActiveTrip(tripId, title);
      }

      if (isSupabaseConfigured()) {
        await saveTripToSupabase({
          tripId,
          title,
          startDate,
          dayCount,
          places,
          scheduledPlaces,
          dayItineraries,
        });
      }

      setEditingTripId(null);
      await loadTripsList();
    } catch (e) {
      console.warn('Rename trip error:', e);
    }
  };

  // Delete Trip Folder
  const handleDeleteTrip = async (tripId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`'${title}' 여행 폴더를 삭제하시겠습니까?`)) return;

    if (!supabase) return;
    try {
      await supabase.from('trips').delete().eq('id', tripId);
      if (tripId === activeTripId) {
        const loaded = await loadTripFromSupabase('aa_trip_main');
        setActiveTrip('aa_trip_main', '스마트 광주 여행');
        if (loaded) {
          loadFullTripState({
            startDate: loaded.startDate || '2026-08-16',
            dayCount: loaded.dayCount || 3,
            places: loaded.places || [],
            scheduledPlaces: loaded.scheduledPlaces || [],
          });
        }
      }
      await loadTripsList();
    } catch (err) {
      console.warn('Delete trip error:', err);
    }
  };

  const defaultTrips = trips.length > 0 ? trips : [
    { id: 'aa_trip_main', title: activeTripTitle || '스마트 광주 여행' }
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto shadow-2xs">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] font-black text-slate-400 flex items-center gap-1 mr-1 shrink-0">
          <Folder className="w-3.5 h-3.5 text-emerald-600" />
          <span>여행 폴더:</span>
        </span>

        {defaultTrips.map((t) => {
          const isActive = t.id === activeTripId;
          const isEditing = t.id === editingTripId;

          if (isEditing) {
            return (
              <div key={t.id} className="flex items-center gap-1 bg-amber-50 border border-amber-300 p-1 rounded-lg shrink-0">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(t.id)}
                  className="px-2 py-0.5 text-xs font-black bg-white border border-amber-300 rounded outline-none text-slate-900 w-32"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveRename(t.id)}
                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  title="폴더명 저장"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setEditingTripId(null)}
                  className="p-1 text-slate-500 rounded hover:bg-slate-200"
                  title="취소"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={t.id}
              onClick={() => handleSelectTrip(t)}
              onDoubleClick={(e) => startRenameTrip(t.id, t.title, e)}
              className={`group flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black cursor-pointer transition-all border shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs scale-[1.02]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
              }`}
              title="더블 클릭하여 폴더명 수정"
            >
              <Folder className={`w-3 h-3 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
              <span>{t.title || '여행 폴더'}</span>

              <button
                onClick={(e) => startRenameTrip(t.id, t.title, e)}
                className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  isActive ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-300 text-slate-500'
                }`}
                title="폴더 이름 변경"
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>

              {t.id !== 'aa_trip_main' && (
                <button
                  onClick={(e) => handleDeleteTrip(t.id, t.title, e)}
                  className={`p-0.5 rounded hover:bg-rose-500 hover:text-white transition-colors ${
                    isActive ? 'text-slate-400' : 'text-slate-400'
                  }`}
                  title="폴더 삭제"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* New Trip Folder Button */}
        {isCreating ? (
          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-300 p-1 rounded-lg shrink-0">
            <input
              type="text"
              placeholder="예: 제주 3박4일"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTrip()}
              className="px-2 py-0.5 text-xs font-bold bg-white border border-emerald-300 rounded outline-none text-slate-900 w-32"
              autoFocus
            />
            <button
              onClick={handleCreateTrip}
              className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700"
            >
              생성
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-1.5 py-0.5 text-slate-500 text-xs font-bold hover:text-slate-800"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all shrink-0 shadow-2xs"
            title="새로운 지역/여행 폴더 생성"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 여행 폴더</span>
          </button>
        )}
      </div>

      {/* Real-time DB Sync Indicator */}
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold shrink-0">
        {autoSaveStatus === 'saving' ? (
          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>DB 저장 중...</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>DB 실시간 자동 저장됨</span>
          </span>
        )}
      </div>
    </div>
  );
}
