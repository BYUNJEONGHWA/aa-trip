'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { getDayColorTheme } from '@/lib/constants';
import { validateScheduledPlace, calculateDistanceKm } from '@/lib/routeOptimizer';
import { X, Printer, Share2, Copy, Check, MapPin, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function ExportModal() {
  const {
    isExportModalOpen,
    setIsExportModalOpen,
    startDate,
    dayCount,
    dayItineraries,
    scheduledPlaces,
    places,
  } = useAppStore();

  const [copied, setCopied] = React.useState(false);

  if (!isExportModalOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let fullText = `📍 여행 스마트 일정표 (${startDate} ~ ${dayCount}일간)\n\n`;

    dayItineraries.forEach((it) => {
      const theme = getDayColorTheme(it.dayIndex);
      fullText += `[${it.title} | ${it.dateStr} (${it.weekdayLabel})]\n`;

      const daySchedules = scheduledPlaces
        .filter((s) => s.dayIndex === it.dayIndex)
        .sort((a, b) => a.order - b.order);

      if (daySchedules.length === 0) {
        fullText += `  - 등록된 일정이 없습니다.\n`;
      } else {
        daySchedules.forEach((s, idx) => {
          const p = places.find((place) => place.id === s.placeId);
          if (p) {
            fullText += `  ${idx + 1}. ${p.name} (${p.category}) - ${p.operatingHours.display}\n`;
          }
        });
      }

      if (it.notes) {
        fullText += `  📝 메모: ${it.notes}\n`;
      }
      fullText += `\n`;
    });

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">여행 일정표 요약 &amp; 내보내기</h2>
              <p className="text-xs text-slate-400">
                {startDate} 시작 • 총 {dayCount}일간의 스마트 여행 일정
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '복사 완료!' : '텍스트 복사'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>인쇄 / PDF 저장</span>
            </button>
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Itinerary Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-white" id="printable-area">
          {dayItineraries.map((it) => {
            const theme = getDayColorTheme(it.dayIndex);
            const daySchedules = scheduledPlaces
              .filter((s) => s.dayIndex === it.dayIndex)
              .sort((a, b) => a.order - b.order);

            return (
              <div
                key={it.dayIndex}
                className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-3"
              >
                {/* Day Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-3 py-1 rounded-full text-white text-xs font-black"
                      style={{ backgroundColor: theme.color }}
                    >
                      {it.title}
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {it.dateStr} ({it.weekdayLabel})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">
                    방문 장소: {daySchedules.length}곳
                  </span>
                </div>

                {/* Places */}
                {daySchedules.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">등록된 장소가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {daySchedules.map((s, idx) => {
                      const p = places.find((place) => place.id === s.placeId);
                      if (!p) return null;
                      const issues = validateScheduledPlace(p, it.weekday);
                      const isWarning = issues.some((i) => i.type === 'DAY_OFF');

                      return (
                        <div
                          key={s.scheduleId}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            isWarning
                              ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                              : 'bg-slate-900 border-slate-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-5 h-5 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0"
                              style={{ backgroundColor: theme.color }}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{p.name}</span>
                                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                  {p.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{p.address}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 text-right">
                            <div className="text-[11px] text-slate-400">
                              <span className="block font-medium">{p.operatingHours.display}</span>
                              <span className="text-[10px] text-slate-500">
                                {p.isEveryday ? '연중무휴' : p.dayOffRaw || '휴무 정보 확인'}
                              </span>
                            </div>

                            {isWarning && (
                              <span className="px-2 py-0.5 rounded bg-rose-500 text-slate-950 font-extrabold text-[10px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                휴무일 주의!
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Notes */}
                {it.notes && (
                  <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300">
                    <strong className="text-emerald-400 block mb-1">📝 메모 사항:</strong>
                    <p className="whitespace-pre-wrap leading-relaxed">{it.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
