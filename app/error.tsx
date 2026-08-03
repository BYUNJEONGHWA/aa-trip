'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Client Error Caught]:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-lg">
          <AlertTriangle className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-white">화면을 불러오는 중 일시적 오류 발생</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            데이터 갱신 중 예외가 발생했습니다. [다시 시도하기] 버튼을 누르면 화면이 즉시 복구됩니다.
          </p>
        </div>

        {error?.message && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-amber-400 text-left overflow-x-auto max-h-28">
            {error.message}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>다시 시도하기</span>
          </button>

          <button
            onClick={() => window.location.reload()}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>새로고침</span>
          </button>
        </div>
      </div>
    </div>
  );
}
