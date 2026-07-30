'use client';

import React, { useState, useEffect } from 'react';
import { Key, X, Check, ExternalLink, AlertTriangle } from 'lucide-react';

interface NaverKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NaverKeyModal({ isOpen, onClose }: NaverKeyModalProps) {
  const [keyInput, setKeyInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const stored = localStorage.getItem('NAVER_MAP_CLIENT_ID') || '';
      setKeyInput(stored);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      const cleanKey = keyInput.replace(/["']/g, '').trim();
      localStorage.setItem('NAVER_MAP_CLIENT_ID', cleanKey);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
        window.location.reload();
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">네이버 지도 API Key 설정</h3>
            <p className="text-xs text-slate-400">Naver Maps Client ID 연동</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            네이버 클라우드 Application Client ID
          </label>
          <input
            type="text"
            placeholder="Client ID (예: 83x... 또는 영문/숫자 조합 아이디)"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 space-y-1">
            <div className="flex items-center gap-1 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>주의: Client Secret이 아닌 Client ID를 넣으셔야 합니다!</span>
            </div>
            <p className="text-amber-400/80">
              * 네이버 콘솔에 표시된 [Client ID]를 복사해서 넣어주세요.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
          <div className="font-semibold text-emerald-400 flex items-center justify-between">
            <span>💡 인증 에러 방지 등록 주소 목록</span>
            <a
              href="https://www.ncloud.com"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white flex items-center gap-0.5 underline"
            >
              ncloud 콘솔 <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p>네이버 콘솔 Web 서비스 URL 란에 아래 3개를 등록해 두시면 인증에러가 완전히 방지됩니다:</p>
          <ul className="list-disc pl-4 space-y-0.5 font-mono text-emerald-300/90 text-[10px]">
            <li>http://localhost:3030</li>
            <li>http://127.0.0.1:3030</li>
            <li>http://localhost</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>저장 완료!</span>
              </>
            ) : (
              <span>설정 저장하기</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
