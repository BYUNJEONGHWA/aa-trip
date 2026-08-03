import { DayColorTheme, DayOfWeek, Place } from './types';

export const DAY_OFF_OPTIONS: { id: string; label: string; value: string }[] = [
  { id: 'ALL', label: '전체', value: 'ALL' },
  { id: 'EVERYDAY', label: '연중무휴', value: 'EVERYDAY' },
  { id: 'Mon', label: '월요일 휴무', value: 'Mon' },
  { id: 'Tue', label: '화요일 휴무', value: 'Tue' },
  { id: 'Wed', label: '수요일 휴무', value: 'Wed' },
  { id: 'Thu', label: '목요일 휴무', value: 'Thu' },
  { id: 'Fri', label: '금요일 휴무', value: 'Fri' },
  { id: 'Sat', label: '토요일 휴무', value: 'Sat' },
  { id: 'Sun', label: '일요일 휴무', value: 'Sun' },
];

export const WEEKDAY_KOREAN: Record<DayOfWeek, string> = {
  Mon: '월요일',
  Tue: '화요일',
  Wed: '수요일',
  Thu: '목요일',
  Fri: '금요일',
  Sat: '토요일',
  Sun: '일요일',
};

export const DAY_COLOR_THEMES: DayColorTheme[] = [
  {
    dayIndex: 0,
    color: '#2563EB', // Blue
    badgeBg: 'bg-blue-600',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500',
    name: '파랑 (1일차)',
  },
  {
    dayIndex: 1,
    color: '#DC2626', // Red
    badgeBg: 'bg-red-600',
    textColor: 'text-red-600',
    borderColor: 'border-red-500',
    name: '빨강 (2일차)',
  },
  {
    dayIndex: 2,
    color: '#16A34A', // Green
    badgeBg: 'bg-green-600',
    textColor: 'text-green-600',
    borderColor: 'border-green-500',
    name: '초록 (3일차)',
  },
  {
    dayIndex: 3,
    color: '#D97706', // Amber
    badgeBg: 'bg-amber-600',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500',
    name: '주황 (4일차)',
  },
  {
    dayIndex: 4,
    color: '#7C3AED', // Purple
    badgeBg: 'bg-purple-600',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-500',
    name: '보라 (5일차)',
  },
  {
    dayIndex: 5,
    color: '#DB2777', // Pink
    badgeBg: 'bg-pink-600',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-500',
    name: '분홍 (6일차)',
  },
  {
    dayIndex: 6,
    color: '#0D9488', // Teal
    badgeBg: 'bg-teal-600',
    textColor: 'text-teal-600',
    borderColor: 'border-teal-500',
    name: '청록 (7일차)',
  },
];

export const getDayColorTheme = (dayIndex: number): DayColorTheme => {
  return DAY_COLOR_THEMES[dayIndex % DAY_COLOR_THEMES.length];
};

export const INITIAL_PLACES: Place[] = [];

/**
 * Single Source of Truth for Naver Map SDK Client ID resolution
 */
export const getNaverMapClientId = (): string => {
  const envKey = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
  const cleanEnv = (envKey || '').trim();
  if (cleanEnv) return cleanEnv;

  if (typeof window !== 'undefined') {
    const stored = (localStorage.getItem('NAVER_MAP_CLIENT_ID') || '').trim();
    if (stored) return stored;
  }

  return 'scqr0strs4'; // Verified Default Client ID
};

/**
 * Permanently Fixed Naver Map Script URL Generator
 * Official Specification: ncpKeyId & submodules=geocoder
 */
export const getNaverMapScriptUrl = (clientId?: string): string => {
  const key = clientId || getNaverMapClientId();
  return `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${key}&submodules=geocoder`;
};
