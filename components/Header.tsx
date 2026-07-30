'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import NaverKeyModal from './Modals/NaverKeyModal';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  Calendar,
  Plus,
  Minus,
  Upload,
  Share2,
  Car,
  MapPin,
  Key,
  Search,
  Database,
  Settings,
} from 'lucide-react';

export default function Header() {
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const {
    startDate,
    setStartDate,
    dayCount,
    setDayCount,
    addDay,
    filterParkingOnly,
    setFilterParkingOnly,
    setIsIngestModalOpen,
    setIsExportModalOpen,
    setIsSearchModalOpen,
    setIsSupabaseModalOpen,
  } = useAppStore();

  const isDbConnected = isSupabaseConfigured();

  return (
    <header className="min-h-[56px] py-2 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between gap-2 z-30 shrink-0 shadow-xs flex-wrap">
      {/* Brand Title */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/20 shrink-0">
          <MapPin className="w-5 h-5 sm:w-6 sm:h-6 fill-white stroke-emerald-600" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900">
              아아트립 <span className="text-emerald-600 font-extrabold text-xs sm:text-sm hidden sm:inline">(Aa-Trip)</span>
            </h1>
            <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300/60 shrink-0">
              NAVER Map
            </span>
          </div>
        </div>
      </div>

      {/* Structured & Grouped Action Toolbar */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
        {/* Group 1: 장소 검색 & 불러오기 (Emerald Box) */}
        <div className="flex items-center gap-1 bg-emerald-50/80 p-1 rounded-xl border border-emerald-200/80">
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Search className="w-3.5 h-3.5 text-white" />
            <span>장소 검색</span>
          </button>
          <button
            onClick={() => setIsIngestModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition-all shadow-2xs"
            title="네이버 지도 공유 URL 리스트 불러오기"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>리스트 불러오기</span>
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200"></div>

        {/* Group 2: DB & API 연동 설정 (Slate Box with Connection Status) */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setIsSupabaseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-black transition-all shadow-2xs border border-slate-200/70"
            title="지역별 여행 폴더 관리 & Supabase DB 저장/불러오기"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isDbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            ></span>
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>📁 여행 폴더 & DB</span>
          </button>
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs border border-slate-200/70"
            title="네이버 지도 API 키 설정"
          >
            <Key className="w-3.5 h-3.5 text-amber-600" />
            <span>API 키</span>
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200"></div>

        {/* Group 3: 일정 공유 & Export (Primary Accent Box) */}
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Share2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>공유 / Export</span>
        </button>
      </div>

      <NaverKeyModal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} />
    </header>
  );
}
