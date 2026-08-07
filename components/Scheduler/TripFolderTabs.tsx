'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  fetchAllTripsFromSupabase,
  loadTripFromSupabase,
  saveTripToSupabase,
  updateTripTitleInSupabase,
  updateTripPasswordInSupabase,
  subscribeToTripChanges,
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabase';
import { hashFolderPassword, isFolderUnlocked, markFolderUnlocked } from '@/lib/folderLock';
import { Folder, Plus, Trash2, CheckCircle2, RefreshCw, Edit2, Check, X, Lock, KeyRound } from 'lucide-react';

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
    isDbInitialLoaded,
    setIsDbInitialLoaded,
    loadFullTripState,
    autoSaveStatus,
    setAutoSaveStatus,
  } = useAppStore();

  const [trips, setTrips] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Inline Folder Rename state
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Inline Folder Password-Unlock state (folder has a password & isn't unlocked yet this session)
  const [unlockingTrip, setUnlockingTrip] = useState<any>(null);
  const [unlockInput, setUnlockInput] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // autoSaveStatus comes from the store, written by the single auto-saver in app/page.tsx

  // Fetch all trips from Supabase DB on mount or when activeTripId changes
  const loadTripsList = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const list = await fetchAllTripsFromSupabase();
      setTrips(list || []);
    } catch (e) {
      console.warn('Load trips error:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isMounted) {
      loadTripsList();
    }

    let unsubscribe: any = null;
    if (isSupabaseConfigured()) {
      try {
        unsubscribe = subscribeToTripChanges(() => {
          if (isMounted) {
            loadTripsList();
          }
        });
      } catch (e) {
        console.warn('Realtime subscription setup error:', e);
      }
    }

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch (e) {}
      }
    };
  }, [activeTripId]);

  // NOTE: this component used to run its OWN debounced auto-save (300ms) with the same
  // payload and deps as the one in app/page.tsx (1000ms) — two savers firing per state
  // change, ~700ms apart. Each save is a non-atomic DELETE-then-INSERT of the whole
  // trip, so the two racing each other duplicated every schedule row. It also lacked
  // page.tsx's first-run guard, so it wrote back state it had just loaded.
  // app/page.tsx is now the single auto-saver; it updates autoSaveStatus for the badge
  // below. Saves are additionally serialized in lib/supabase.ts.

  // Switch Active Trip Folder with isolated places/schedules
  const switchToTrip = async (trip: any) => {
    try {
      const loaded = await loadTripFromSupabase(trip.id);
      const targetTitle = loaded?.title || trip.title || '여행 일정';
      setActiveTrip(trip.id, targetTitle);

      loadFullTripState({
        tripId: trip.id,
        title: targetTitle,
        startDate: loaded?.startDate || '2026-08-16',
        dayCount: loaded?.dayCount || 3,
        places: loaded?.places || [],
        scheduledPlaces: loaded?.scheduledPlaces || [],
        dayItineraries: loaded?.dayItineraries || [],
      });
    } catch (e) {
      console.warn('Load trip failed:', e);
    }
  };

  const handleSelectTrip = async (trip: any) => {
    if (editingTripId) return; // Ignore switch if currently editing
    if (trip.id === activeTripId) return;

    if (trip.folder_password_hash && !isFolderUnlocked(trip.id)) {
      setUnlockingTrip(trip);
      setUnlockInput('');
      setUnlockError('');
      return;
    }

    await switchToTrip(trip);
  };

  const handleUnlockSubmit = async () => {
    if (!unlockingTrip) return;
    const inputHash = await hashFolderPassword(unlockInput);
    if (inputHash !== unlockingTrip.folder_password_hash) {
      setUnlockError('비밀번호가 일치하지 않습니다.');
      return;
    }
    markFolderUnlocked(unlockingTrip.id);
    const trip = unlockingTrip;
    setUnlockingTrip(null);
    await switchToTrip(trip);
  };

  // Set / change / remove a folder's password. Native prompt keeps this consistent
  // with the existing delete-folder confirm() — it's an infrequent admin action, not
  // the primary flow, so a full modal would be overkill.
  const handleSetPassword = async (trip: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const input = window.prompt(
      `'${trip.title}' 폴더의 비밀번호를 입력하세요.\n(비워두고 확인을 누르면 잠금이 해제됩니다)`,
      ''
    );
    if (input === null) return; // cancelled

    const newHash = input.trim() ? await hashFolderPassword(input.trim()) : null;
    const ok = await updateTripPasswordInSupabase(trip.id, newHash);
    if (ok && newHash) markFolderUnlocked(trip.id); // setting it yourself shouldn't lock you out
    await loadTripsList();
  };

  // Create New Trip Folder (Clean isolated state)
  const handleCreateTrip = async () => {
    const title = newTitle.trim();
    if (!title) return;

    const newTripId = `trip_${Date.now()}`;
    try {
      if (isSupabaseConfigured()) {
        await saveTripToSupabase({
          tripId: newTripId,
          title,
          startDate: '2026-08-16',
          dayCount: 3,
          places: [],
          scheduledPlaces: [],
          dayItineraries: [],
        });
      }

      setActiveTrip(newTripId, title);
      loadFullTripState({
        tripId: newTripId,
        title,
        startDate: '2026-08-16',
        dayCount: 3,
        places: [],
        scheduledPlaces: [],
        dayItineraries: [],
      });

      setNewTitle('');
      setIsCreating(false);
      await loadTripsList();
    } catch (e) {
      console.warn('Create trip error:', e);
    }
  };

  // Rename Trip Folder (Mobile Touch & Enter & Blur Support)
  const startRenameTrip = (tripId: string, currentTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
        setAutoSaveStatus('saving');
        await updateTripTitleInSupabase(tripId, title);
        setAutoSaveStatus('saved');
      }

      setEditingTripId(null);
      await loadTripsList();
    } catch (e) {
      console.warn('Rename trip error:', e);
      setAutoSaveStatus('idle');
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
            dayItineraries: loaded.dayItineraries || [],
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
          const isUnlocking = t.id === unlockingTrip?.id;

          if (isUnlocking) {
            return (
              <div key={t.id} className="flex items-center gap-1 bg-slate-50 border border-slate-300 p-1 rounded-lg shrink-0">
                <Lock className="w-3 h-3 text-slate-500 ml-1" />
                <input
                  type="password"
                  value={unlockInput}
                  onChange={(e) => {
                    setUnlockInput(e.target.value);
                    setUnlockError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
                  placeholder="비밀번호"
                  autoFocus
                  className={`px-2 py-0.5 text-xs font-black bg-white border rounded outline-none text-slate-900 w-28 ${
                    unlockError ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                <button
                  onClick={handleUnlockSubmit}
                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  title="잠금 해제"
                >
                  <KeyRound className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setUnlockingTrip(null)}
                  className="p-1 text-slate-500 rounded hover:bg-slate-200"
                  title="취소"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          }

          if (isEditing) {
            return (
              <div key={t.id} className="flex items-center gap-1 bg-amber-50 border border-amber-300 p-1 rounded-lg shrink-0">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleSaveRename(t.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(t.id)}
                  className="px-2 py-0.5 text-xs font-black bg-white border border-amber-300 rounded outline-none text-slate-900 w-32"
                  autoFocus
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent onBlur from triggering before onClick
                    handleSaveRename(t.id);
                  }}
                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  title="폴더명 저장"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setEditingTripId(null);
                  }}
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
              title="클릭하여 폴더 선택 / 버튼 터치하여 이름 수정"
            >
              <Folder className={`w-3 h-3 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
              <span>{t.title || '여행 폴더'}</span>
              {t.folder_password_hash && (
                <Lock className={`w-3 h-3 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
              )}

              <button
                onClick={(e) => startRenameTrip(t.id, t.title, e)}
                className={`p-1 rounded transition-opacity ${
                  isActive
                    ? 'hover:bg-slate-800 text-slate-300 opacity-90'
                    : 'hover:bg-slate-300 text-slate-500 opacity-70 group-hover:opacity-100'
                }`}
                title="폴더 이름 변경"
              >
                <Edit2 className="w-3 h-3" />
              </button>

              <button
                onClick={(e) => handleSetPassword(t, e)}
                className={`p-1 rounded transition-opacity ${
                  isActive
                    ? 'hover:bg-slate-800 text-slate-300 opacity-90'
                    : 'hover:bg-slate-300 text-slate-500 opacity-70 group-hover:opacity-100'
                }`}
                title={t.folder_password_hash ? '폴더 비밀번호 변경/해제' : '폴더 비밀번호 설정'}
              >
                <KeyRound className="w-3 h-3" />
              </button>

              {t.id !== 'aa_trip_main' && (
                <button
                  onClick={(e) => handleDeleteTrip(t.id, t.title, e)}
                  className={`p-1 rounded hover:bg-rose-500 hover:text-white transition-colors ${
                    isActive ? 'text-slate-400' : 'text-slate-400'
                  }`}
                  title="폴더 삭제"
                >
                  <Trash2 className="w-3 h-3" />
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
        ) : autoSaveStatus === 'error' ? (
          <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 animate-pulse">
            <X className="w-3 h-3 text-rose-600" />
            <span>❌ DB 저장 실패</span>
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
