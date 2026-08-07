'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fetchTripPasswordHash, loadTripFromSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { hashFolderPassword, isFolderUnlocked, markFolderUnlocked } from '@/lib/folderLock';
import { Lock, KeyRound } from 'lucide-react';

/**
 * Full-screen gate shown whenever the active trip folder has a password set and
 * hasn't been unlocked yet this browser session. Sits on top of everything else so
 * a locked folder's places/schedule never render on screen before the password is
 * checked — including the very first auto-load on page mount, not just folder
 * switches (that path is separately guarded in TripFolderTabs).
 */
export default function FolderPasswordGate() {
  const { activeTripId, activeTripTitle, isDbInitialLoaded, setActiveTrip, loadFullTripState } = useAppStore();

  const [requiredHash, setRequiredHash] = useState<string | null>(null);
  const [checkedTripId, setCheckedTripId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isDbInitialLoaded || !isSupabaseConfigured() || !activeTripId) return;
    if (isFolderUnlocked(activeTripId)) {
      setRequiredHash(null);
      setCheckedTripId(activeTripId);
      return;
    }

    let cancelled = false;
    setChecking(true);
    fetchTripPasswordHash(activeTripId).then((hash) => {
      if (cancelled) return;
      setRequiredHash(hash);
      setCheckedTripId(activeTripId);
      setPasswordInput('');
      setError('');
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTripId, isDbInitialLoaded]);

  const isLocked = !!requiredHash && checkedTripId === activeTripId;

  if (!isLocked) return null;

  const handleUnlock = async () => {
    const inputHash = await hashFolderPassword(passwordInput);
    if (inputHash === requiredHash) {
      markFolderUnlocked(activeTripId);
      setRequiredHash(null);
      setError('');
    } else {
      setError('비밀번호가 일치하지 않습니다.');
    }
  };

  const handleGoToMain = async () => {
    const loaded = await loadTripFromSupabase('aa_trip_main');
    setActiveTrip('aa_trip_main', loaded?.title || '스마트 광주 여행');
    if (loaded) {
      loadFullTripState({
        startDate: loaded.startDate || '2026-08-16',
        dayCount: loaded.dayCount || 3,
        places: loaded.places || [],
        scheduledPlaces: loaded.scheduledPlaces || [],
        dayItineraries: loaded.dayItineraries || [],
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="font-black text-sm">잠긴 여행 폴더</div>
            <div className="text-xs text-slate-500 font-bold">{activeTripTitle || '여행 폴더'}</div>
          </div>
        </div>

        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          placeholder="비밀번호 입력"
          autoFocus
          className="w-full px-3 py-2.5 text-sm font-bold border border-slate-300 rounded-xl outline-none focus:border-emerald-500 text-slate-900"
        />

        {error && <div className="text-xs font-bold text-rose-600">{error}</div>}

        <button
          onClick={handleUnlock}
          disabled={checking || !passwordInput}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-black rounded-xl transition-all"
        >
          <KeyRound className="w-4 h-4" />
          <span>잠금 해제</span>
        </button>

        {activeTripId !== 'aa_trip_main' && (
          <button
            onClick={handleGoToMain}
            className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 py-1"
          >
            비밀번호를 모르시나요? 기본 폴더로 이동
          </button>
        )}
      </div>
    </div>
  );
}
