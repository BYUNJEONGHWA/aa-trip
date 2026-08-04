export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type DayOffFilter = 'ALL' | 'EVERYDAY' | DayOfWeek;

export type HolidayType = 'WEEKLY' | 'VARIABLE_REGULAR' | 'NONE';

export interface OffRule {
  day: string; // e.g. "월", "일", "화"
  weeks: number[]; // e.g. [2, 4] for 2,4th week, or [1, 2, 3, 4, 5] for every week
}

export interface OperatingHours {
  open: string;  // e.g. "11:30"
  close: string; // e.g. "21:30"
  breakTime?: string; // e.g. "15:00 - 17:00"
  lastOrder?: string; // e.g. "20:30"
  display: string; // e.g. "11:30 - 21:30"
}

export interface ScheduleClassification {
  raw_schedule_text: string;
  regular_hours: string;
  holiday_text: string; // e.g., "매달 2, 4번째 월요일 정기 휴무" or "연중무휴 (휴무일 없음)"
  holiday_type: HolidayType; // 'WEEKLY', 'VARIABLE_REGULAR', 'NONE'
  off_days: string[]; // e.g. ["월"], ["일"]
  off_rules: OffRule[]; // e.g. [{ day: "월", weeks: [2, 4] }]
  is_always_open: boolean; // 연중무휴 여부 플래그
}

export interface Place {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  operatingHours: OperatingHours;
  dayOffs: DayOfWeek[]; // Normalized list of closed days (e.g. ['Mon'])
  isEveryday: boolean; // True if 연중무휴 or open 7 days a week
  dayOffRaw?: string; // Raw day off text (e.g. "매주 월요일", "2/4번째 수요일")
  holiday_text?: string;
  holiday_type?: HolidayType;
  off_days?: string[]; // e.g. ["월"]
  off_rules?: OffRule[]; // e.g. [{ day: "월", weeks: [2, 4] }]
  scheduleDetail?: ScheduleClassification;
  hasParking: boolean;
  parkingText?: string;
  phone?: string;
  naverUrl?: string;
  rating?: number;
  imageUrl?: string;
}

export interface ScheduledPlace {
  scheduleId: string; // Unique ID for instance in itinerary
  placeId: string; // Empty string for BREAK items (no real place)
  dayIndex: number; // 0 for Day 1, 1 for Day 2, etc.
  order: number; // Sequence index within the day (0, 1, 2...)
  type?: 'PLACE' | 'BREAK'; // Defaults to 'PLACE' when omitted
  breakLabel?: string; // e.g. "점심 식사", "휴식" - only for BREAK items
  breakDurationMinutes?: number; // e.g. 30 - only for BREAK items
  startTime?: string; // e.g. "10:30"
  endTime?: string;   // e.g. "12:00"
  notes?: string;
}

export interface DayItinerary {
  dayIndex: number;
  title: string; // e.g., "1일차"
  dateStr: string; // "YYYY-MM-DD"
  weekday: DayOfWeek;
  weekdayLabel: string; // e.g., "월요일", "토요일"
  notes: string;
  scheduleIds: string[]; // List of ScheduledPlace scheduleIds in order
}

export interface DayColorTheme {
  dayIndex: number;
  color: string;      // HEX code (e.g. "#2563EB")
  badgeBg: string;    // Tailwind class
  textColor: string;  // Tailwind text class
  borderColor: string;// Tailwind border class
  name: string;
}

export interface ValidationIssue {
  type: 'DAY_OFF' | 'OUTSIDE_HOURS';
  message: string;
  severity: 'WARNING' | 'ERROR';
}
