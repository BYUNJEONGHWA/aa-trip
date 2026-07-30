import { DayOfWeek, HolidayType, OffRule, OperatingHours, Place, ScheduleClassification } from './types';

// Day mapping for Korean weekday detection
const KOREAN_DAY_MAP: Record<string, DayOfWeek> = {
  '월': 'Mon', '월요일': 'Mon',
  '화': 'Tue', '화요일': 'Tue',
  '수': 'Wed', '수요일': 'Wed',
  '목': 'Thu', '목요일': 'Thu',
  '금': 'Fri', '금요일': 'Fri',
  '토': 'Sat', 'sat요일': 'Sat', '토요일': 'Sat',
  '일': 'Sun', 'sun요일': 'Sun', '일요일': 'Sun',
};

const DAY_TO_KOREAN: Record<DayOfWeek, string> = {
  Mon: '월',
  Tue: '화',
  Wed: '수',
  Thu: '목',
  Fri: '금',
  Sat: '토',
  Sun: '일',
};

/**
 * Parses week numbers from Korean text (e.g. "매달 2, 4번째" -> [2, 4], "첫째, 셋째" -> [1, 3])
 */
function parseWeekNumbers(phrase: string): number[] {
  const weeks = new Set<number>();

  if (phrase.includes('첫째') || phrase.includes('1번째') || phrase.includes('1,') || phrase.includes('1번째')) weeks.add(1);
  if (phrase.includes('둘째') || phrase.includes('2번째') || phrase.includes('2,') || phrase.includes('2번째')) weeks.add(2);
  if (phrase.includes('셋째') || phrase.includes('3번째') || phrase.includes('3,') || phrase.includes('3번째')) weeks.add(3);
  if (phrase.includes('넷째') || phrase.includes('4번째') || phrase.includes('4,') || phrase.includes('4번째')) weeks.add(4);
  if (phrase.includes('다섯째') || phrase.includes('5번째') || phrase.includes('5,') || phrase.includes('5번째')) weeks.add(5);

  // Regex check for numbers like "2, 4번째" or "1, 3번째"
  const digitsMatch = phrase.match(/(\d)(?:\s*,\s*(\d))*\s*번째/);
  if (digitsMatch) {
    const numbers = phrase.match(/\d/g);
    if (numbers) {
      numbers.forEach((n) => {
        const num = parseInt(n, 10);
        if (num >= 1 && num <= 5) weeks.add(num);
      });
    }
  }

  // If no specific week digits/words found, default to ALL 5 weeks (매주)
  if (weeks.size === 0) {
    return [1, 2, 3, 4, 5];
  }

  return Array.from(weeks).sort((a, b) => a - b);
}

/**
 * Enhanced Schedule & Day Off Classifier with Week Rule Granularity:
 * 1. holiday_type: 'WEEKLY' | 'VARIABLE_REGULAR' | 'NONE'
 * 2. off_rules: [{ day: "월", weeks: [2, 4] }]
 * 3. off_days: string[] (e.g. ["월"], ["일"])
 * 4. holiday_text: string (e.g. "매달 2, 4번째 월요일 정기 휴무" or "연중무휴 (휴무일 없음)")
 */
export function parseScheduleClassification(
  hoursText: string = '',
  dayOffText: string = ''
): {
  classification: ScheduleClassification;
  operatingHours: OperatingHours;
  dayOffs: DayOfWeek[];
  off_days: string[];
  off_rules: OffRule[];
  holiday_type: HolidayType;
  isEveryday: boolean;
  dayOffRaw: string;
} {
  const cleanHoursText = hoursText.trim();
  const cleanDayOffText = dayOffText.trim();
  const rawScheduleText = `${cleanHoursText} ${cleanDayOffText}`.trim() || '영업시간 정보 없음';
  const lowerText = rawScheduleText.toLowerCase();

  const detectedDays = new Set<DayOfWeek>();
  const offRulesMap = new Map<string, Set<number>>();

  let explicitHolidayPhrase = '';
  let isVariablePattern = false;

  // Exclude static i18n template placeholders (e.g. {{day}})
  if (!rawScheduleText.includes('{{')) {
    // Check for variable patterns like "매달 2, 4번째 월요일", "첫째, 셋째 일요일", "격주 수요일"
    const variablePatternRegex = /(매달|매월|첫째|둘째|셋째|넷째|다섯째|\d\s*,\s*\d번째|격주)/;
    if (variablePatternRegex.test(rawScheduleText)) {
      isVariablePattern = true;
    }

    // Match all closed day phrases
    const holidayPattern = /((?:매달|매주|매월)\s*[\d,\s번째\w]*?\s*[월화수목금토일]요일?\s*(?:정기\s*)?휴무|(?:월|화|수|목|금|토|일)\s*정기\s*휴무|\(매주\s*[월화수목금토일]요일?\)|[월화수목금토일]요일?\s*(?:정기\s*)?휴무)/g;
    
    let holidayMatch;
    while ((holidayMatch = holidayPattern.exec(rawScheduleText)) !== null) {
      const phrase = holidayMatch[1].trim();
      if (phrase && !explicitHolidayPhrase) {
        explicitHolidayPhrase = phrase;
      }
      const dayMatch = phrase.match(/([월화수목금토일])/);
      if (dayMatch && KOREAN_DAY_MAP[dayMatch[1]]) {
        const dayOfWeek = KOREAN_DAY_MAP[dayMatch[1]];
        const korDay = DAY_TO_KOREAN[dayOfWeek];
        detectedDays.add(dayOfWeek);

        const weeks = parseWeekNumbers(phrase);
        if (!offRulesMap.has(korDay)) {
          offRulesMap.set(korDay, new Set(weeks));
        } else {
          weeks.forEach((w) => offRulesMap.get(korDay)!.add(w));
        }
      }
    }
  }

  // Parse time format HH:MM - HH:MM
  const timeMatch = rawScheduleText.match(/(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})|(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  let open = '09:00';
  let close = '21:00';
  let regularHours = cleanHoursText || '09:00 - 21:00';

  if (timeMatch) {
    open = timeMatch[1] || timeMatch[3] || '09:00';
    close = timeMatch[2] || timeMatch[4] || '21:00';
    regularHours = cleanHoursText.includes('매일') ? cleanHoursText : `매일 ${open} - ${close}`;
  } else if (rawScheduleText.includes('24시간')) {
    open = '00:00';
    close = '24:00';
    regularHours = '24시간 영업';
  }

  // Extract Break Time (쉬는 시간 / 브레이크 타임)
  let breakTime: string | undefined = undefined;
  const breakMatch = rawScheduleText.match(/(?:브레이크\s*타임|쉬는\s*시간|휴게\s*시간|break\s*time)\s*:?\s*(\d{1,2}:\d{2}\s*[\s~-]\s*\d{1,2}:\d{2})|(\d{1,2}:\d{2}\s*[\s~-]\s*\d{1,2}:\d{2})\s*(?:브레이크\s*타임|쉬는\s*시간|휴게\s*시간)/i);
  if (breakMatch) {
    breakTime = (breakMatch[1] || breakMatch[2]).replace(/\s*~\s*/, ' - ');
  }

  // Extract Last Order (라스트 오더)
  let lastOrder: string | undefined = undefined;
  const lastOrderMatch = rawScheduleText.match(/(?:라스트\s*오더|마지막\s*주문|last\s*order)\s*:?\s*(\d{1,2}:\d{2})|(\d{1,2}:\d{2})\s*(?:에\s*)?(?:라스트\s*오더|마지막\s*주문)/i);
  if (lastOrderMatch) {
    lastOrder = lastOrderMatch[1] || lastOrderMatch[2];
  }

  let holidayText = '연중무휴 (휴무일 없음)';
  let holidayType: HolidayType = 'NONE';
  let isAlwaysOpen = true;

  if (detectedDays.size > 0 || explicitHolidayPhrase) {
    isAlwaysOpen = false;
    holidayText = explicitHolidayPhrase || `매주 ${Array.from(detectedDays).map(d => DAY_TO_KOREAN[d]).join(', ')}요일 정기 휴무`;
    holidayType = isVariablePattern ? 'VARIABLE_REGULAR' : 'WEEKLY';
  } else if (rawScheduleText.includes('연중무휴') || rawScheduleText.includes('24시간') || rawScheduleText.includes('매일') || lowerText.includes('everyday')) {
    isAlwaysOpen = true;
    holidayText = '연중무휴 (휴무일 없음)';
    holidayType = 'NONE';
  } else {
    isAlwaysOpen = true;
    holidayText = '연중무휴 (휴무일 없음)';
    holidayType = 'NONE';
  }

  const dayOffs = isAlwaysOpen ? [] : Array.from(detectedDays);
  const off_days = isAlwaysOpen ? [] : dayOffs.map(d => DAY_TO_KOREAN[d]);
  
  const off_rules: OffRule[] = isAlwaysOpen
    ? []
    : Array.from(offRulesMap.entries()).map(([korDay, weeksSet]) => ({
        day: korDay,
        weeks: Array.from(weeksSet).sort((a, b) => a - b),
      }));

  const isEveryday = isAlwaysOpen;

  const classification: ScheduleClassification = {
    raw_schedule_text: rawScheduleText,
    regular_hours: regularHours,
    holiday_text: holidayText,
    holiday_type: holidayType,
    off_days,
    off_rules,
    is_always_open: isAlwaysOpen,
  };

  return {
    classification,
    operatingHours: { open, close, breakTime, lastOrder, display: regularHours },
    dayOffs,
    off_days,
    off_rules,
    holiday_type: holidayType,
    isEveryday,
    dayOffRaw: holidayText,
  };
}

/**
 * Legacy wrapper for backwards compatibility
 */
export function parseOperatingAndDayOffs(
  hoursText: string = '',
  dayOffText: string = ''
) {
  const result = parseScheduleClassification(hoursText, dayOffText);
  return {
    operatingHours: result.operatingHours,
    dayOffs: result.dayOffs,
    off_days: result.off_days,
    off_rules: result.off_rules,
    holiday_type: result.holiday_type,
    holiday_text: result.classification.holiday_text,
    isEveryday: result.isEveryday,
    dayOffRaw: result.dayOffRaw,
    scheduleDetail: result.classification,
  };
}

/**
 * Ingest CSV or Text raw list of places
 */
export function parseRawPlaceInput(inputStr: string): Place[] {
  if (!inputStr || !inputStr.trim()) return [];

  const lines = inputStr.split('\n').filter((l) => l.trim().length > 0);
  const places: Place[] = [];

  lines.forEach((line, idx) => {
    const parts = line.split(/,|\t/).map((p) => p.trim());
    if (parts.length < 1) return;

    const name = parts[0] || `장소 ${idx + 1}`;
    const category = parts[1] || '관광/맛집';
    const hoursStr = parts[2] || '09:00 - 20:00';
    const dayOffStr = parts[3] || '';
    const parkingStr = parts[4] || '가능';
    const lat = parseFloat(parts[5]) || 33.45 + idx * 0.02;
    const lng = parseFloat(parts[6]) || 126.55 + idx * 0.03;

    const { operatingHours, dayOffs, off_days, off_rules, holiday_type, holiday_text, isEveryday, dayOffRaw, scheduleDetail } = parseOperatingAndDayOffs(hoursStr, dayOffStr);

    places.push({
      id: `ingest_${Date.now()}_${idx}`,
      name,
      category,
      address: `제주/서울 지역 (${name})`,
      lat,
      lng,
      operatingHours,
      dayOffs,
      isEveryday,
      dayOffRaw,
      holiday_text,
      holiday_type,
      off_days,
      off_rules,
      scheduleDetail,
      hasParking: parkingStr.includes('가능') || parkingStr.includes('true') || parkingStr.includes('Y'),
      rating: 4.5 + (idx % 5) * 0.1,
    });
  });

  return places;
}
