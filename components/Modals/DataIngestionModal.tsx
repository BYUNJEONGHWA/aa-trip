'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { parseRawPlaceInput } from '@/lib/naverParser';
import { X, Upload, Sparkles, Check, Link as LinkIcon, FileText, Loader2, AlertCircle } from 'lucide-react';

const SAMPLE_SHARED_URLS = [
  { label: '제주 여행 저장 목록 (naver.me/jeju_trip)', url: 'https://naver.me/xN8s92a1' },
  { label: '서울 핫플 & 맛집 저장 리스트 (naver.me/seoul_hot)', url: 'https://naver.me/f9K2p0q4' },
];

export default function DataIngestionModal() {
  const { isIngestModalOpen, setIsIngestModalOpen, addPlaces } = useAppStore();

  const [activeMode, setActiveMode] = useState<'URL' | 'TEXT'>('URL');
  const [listUrl, setListUrl] = useState('');
  const [inputText, setInputText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'SUCCESS' | 'ERROR'; text: string } | null>(null);

  if (!isIngestModalOpen) return null;

  // Handle Shared Naver Map List URL Ingestion
  const handleUrlIngest = async () => {
    if (!listUrl.trim()) return;

    setIsLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/parse-naver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '네이버 지도 리스트를 가져오는 데 실패했습니다.');
      }

      if (data.places && data.places.length > 0) {
        addPlaces(data.places);
        setStatusMsg({
          type: 'SUCCESS',
          text: `🎉 네이버 지도 저장 목록에서 총 ${data.places.length}개의 장소(주소/영업시간/휴일/주차 정보)를 추출했습니다!`,
        });

        setTimeout(() => {
          setStatusMsg(null);
          setIsIngestModalOpen(false);
          setListUrl('');
        }, 1500);
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'ERROR',
        text: err.message || '리스트 파싱 중 오류가 발생했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Text/CSV Ingestion
  const handleTextIngest = () => {
    if (!inputText.trim()) return;
    const newPlaces = parseRawPlaceInput(inputText);
    if (newPlaces.length > 0) {
      addPlaces(newPlaces);
      setStatusMsg({
        type: 'SUCCESS',
        text: `🎉 총 ${newPlaces.length}개 장소 정보 추가 완료!`,
      });
      setTimeout(() => {
        setStatusMsg(null);
        setIsIngestModalOpen(false);
        setInputText('');
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                네이버 지도 저장 목록(공유 링크) 불러오기
              </h2>
              <p className="text-xs text-slate-400">
                네이버 지도에서 가고자 하는 장소를 저장한 목록 URL을 공유해 주세요.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsIngestModalOpen(false)}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Mode Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-3">
          <button
            onClick={() => setActiveMode('URL')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeMode === 'URL'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>네이버 지도 공유 URL 입력 (추천)</span>
          </button>
          <button
            onClick={() => setActiveMode('TEXT')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeMode === 'TEXT'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>직접 입력 / CSV 목록</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {activeMode === 'URL' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  네이버 지도 저장 리스트 공유 URL (예: https://naver.me/...):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={listUrl}
                    onChange={(e) => setListUrl(e.target.value)}
                    placeholder="https://naver.me/xxxxxx 또는 https://map.naver.com/..."
                    className="flex-1 bg-slate-950 text-xs text-white placeholder-slate-600 px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    onClick={handleUrlIngest}
                    disabled={isLoading || !listUrl.trim()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-naver-green to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 disabled:opacity-40 flex items-center gap-1.5 transition-all shrink-0"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>파싱 중...</span>
                      </>
                    ) : (
                      <span>목록 장소 불러오기</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Sample Shared URLs */}
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-2">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>테스트용 공유 목록 샘플 링크 클릭:</span>
                </span>
                <div className="flex flex-col gap-1.5">
                  {SAMPLE_SHARED_URLS.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => setListUrl(sample.url)}
                      className="text-left text-xs text-emerald-400 hover:text-emerald-300 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/60 font-mono truncate transition-all"
                    >
                      🔗 {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature Checklist Box */}
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs space-y-1.5">
                <p className="font-bold text-emerald-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  <span>자동 추출 및 일정 검증 항목:</span>
                </p>
                <ul className="text-slate-300 text-[11px] space-y-1 pl-5 list-disc">
                  <li><strong>장소 주소 &amp; 위경도 좌표</strong> (지도 마커 및 동선 시각화)</li>
                  <li><strong>영업시간</strong> (09:00 - 20:00 / 24시간 영업 등)</li>
                  <li><strong>정기 휴무일</strong> (월요일 휴무, 수요일 휴무, 연중무휴 자동 정규화)</li>
                  <li><strong>주차 가능 여부</strong> (주차 가능 / 주차 불가 뱃지)</li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                직접 텍스트 / CSV 목록 입력:
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="형식: 장소명, 카테고리, 영업시간, 휴무일, 주차여부&#10;예시: 성산일출봉, 명소, 07:00 - 19:00, 매주 월요일 휴무, 주차가능"
                rows={7}
                className="w-full bg-slate-950 text-xs text-white placeholder-slate-600 p-3 rounded-2xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
              />
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                statusMsg.type === 'SUCCESS'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              {statusMsg.type === 'SUCCESS' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-2">
          <button
            onClick={() => setIsIngestModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
          >
            닫기
          </button>
          {activeMode === 'TEXT' && (
            <button
              onClick={handleTextIngest}
              disabled={!inputText.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-naver-green to-emerald-600 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 disabled:opacity-40 transition-all"
            >
              장소 파싱 및 추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
