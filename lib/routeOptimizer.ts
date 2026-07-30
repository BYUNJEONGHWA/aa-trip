import { parseISO } from 'date-fns';
import { DayOfWeek, Place, ScheduledPlace, ValidationIssue } from './types';

/**
 * Calculates straight line distance in km between two lat/lng points using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimates travel time in minutes based on distance (assuming ~35 km/h urban average speed)
 */
export function estimateTravelTimeMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const speedKmH = 35;
  const minutes = Math.ceil((distanceKm / speedKmH) * 60) + 5; // 5 mins buffer
  return minutes;
}

/**
 * Route Optimization (Nearest Neighbor Algorithm)
 */
export function optimizeRouteOrder(
  scheduledList: ScheduledPlace[],
  placeMap: Map<string, Place>
): ScheduledPlace[] {
  if (scheduledList.length <= 2) return scheduledList;

  const validItems = scheduledList.filter((item) => placeMap.has(item.placeId));
  if (validItems.length <= 2) return scheduledList;

  const unvisited = [...validItems];
  const result: ScheduledPlace[] = [];

  let current = unvisited.shift()!;
  result.push(current);

  while (unvisited.length > 0) {
    const currentPlace = placeMap.get(current.placeId)!;
    let nearestIndex = 0;
    let shortestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const targetPlace = placeMap.get(unvisited[i].placeId)!;
      const dist = calculateDistanceKm(
        currentPlace.lat,
        currentPlace.lng,
        targetPlace.lat,
        targetPlace.lng
      );
      if (dist < shortestDist) {
        shortestDist = dist;
        nearestIndex = i;
      }
    }

    current = unvisited.splice(nearestIndex, 1)[0];
    result.push(current);
  }

  return result.map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

// 1. 요일 매핑 배열 (JS Date.getDay() 기준: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
export const DAY_MAP = ['일', '월', '화', '수', '목', '금', '토'];

// 2. 선택된 날짜의 정확한 요일 구하기
export function getKoreanDayOfWeek(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  return DAY_MAP[date.getDay()]; // 2026-08-16 기준 -> '일' 반환
}

// 3. 휴무일 판별 함수
export function checkIsClosed(selectedDateStr: string, placeOffDays: string[]): boolean {
  if (!selectedDateStr || !placeOffDays || placeOffDays.length === 0) return false;
  const currentDay = getKoreanDayOfWeek(selectedDateStr); // 예: '일'
  
  // placeOffDays가 ['월'] 일 때, currentDay('일')와 일치하지 않으므로 false(영업중) 반환!
  return placeOffDays.includes(currentDay) || placeOffDays.includes(`${currentDay}요일`);
}

/**
 * Determines if a place is actually closed on a specific calendar date (e.g. "2026-08-17").
 * Accurately evaluates week rules (e.g. 2, 4th Monday closed vs 3rd Monday open).
 */
export function isPlaceClosedOnDate(place: Place, dateStr: string): boolean {
  if (!dateStr || !place) return false;

  try {
    const targetKorDay = getKoreanDayOfWeek(dateStr); // e.g. "일"
    if (!targetKorDay) return false;

    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeekIndex = d.getDay();
    const weekdays: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const targetDayOfWeek = weekdays[dayOfWeekIndex]; // e.g. "Sun"
    const targetKorFull = `${targetKorDay}요일`;       // e.g. "일요일"

    const dayOfMonth = d.getDate();
    const weekNumber = Math.ceil(dayOfMonth / 7); // 1st, 2nd, 3rd, 4th, 5th week

    let isClosedResult = false;

    // Explicitly open check
    if (place.isEveryday && !place.dayOffRaw && !place.holiday_text) {
      isClosedResult = false;
    } else {
      const rawText = `${place.dayOffRaw || ''} ${place.holiday_text || ''} ${place.operatingHours?.display || ''}`;

      // Explicit 연중무휴 check
      if (rawText.includes('연중무휴') && !rawText.includes('정기휴무') && !rawText.includes('정기 휴무') && !rawText.includes('휴무')) {
        isClosedResult = false;
      }
      // 1. Check off_rules if provided (exact day check)
      else if (place.off_rules && Array.isArray(place.off_rules) && place.off_rules.length > 0) {
        const matchingRule = place.off_rules.find(
          (r) => r.day === targetKorFull || r.day === targetKorDay
        );
        if (matchingRule) {
          if (!matchingRule.weeks || matchingRule.weeks.length === 0) {
            isClosedResult = true; // Closed every target day
          } else {
            isClosedResult = matchingRule.weeks.includes(weekNumber);
          }
        }
      }
      // 2. Check if text specifies a week-specific rule for the target weekday (e.g. "매달 4번째 일요일")
      else if (rawText.includes(targetKorFull) || (rawText.includes(`${targetKorDay}요일`) && !rawText.includes(`월요일`))) {
        if (rawText.includes('번째') || rawText.includes('째주') || rawText.includes('주차')) {
          const weekMatch = rawText.match(/([1-5](?:\s*[,.]\s*[1-5])*)\s*(?:번째|째주|주차|회차)/);
          if (weekMatch && weekMatch[1]) {
            const weeks = weekMatch[1].split(/[,.]/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
            isClosedResult = weeks.includes(weekNumber);
          } else {
            isClosedResult = true;
          }
        } else {
          isClosedResult = true;
        }
      }
      // 3. Check weekly dayOffs array (e.g. ['MON'], ['TUE'])
      else if (place.dayOffs && Array.isArray(place.dayOffs) && place.dayOffs.length > 0) {
        const normalizedDayOffs = place.dayOffs.map((d) => d.substring(0, 3).toUpperCase());
        const targetUpper = targetDayOfWeek.toUpperCase();

        if (normalizedDayOffs.includes(targetUpper)) {
          if (rawText.includes('번째') || rawText.includes('째주') || rawText.includes('주차')) {
            const weekMatch = rawText.match(/([1-5](?:\s*[,.]\s*[1-5])*)\s*(?:번째|째주|주차|회차)/);
            if (weekMatch && weekMatch[1]) {
              const weeks = weekMatch[1].split(/[,.]/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
              isClosedResult = weeks.includes(weekNumber);
            } else {
              isClosedResult = true;
            }
          } else {
            isClosedResult = true;
          }
        }
      }
      // 4. Check off_days array (e.g. ['월요일', '화요일'])
      else if (place.off_days && Array.isArray(place.off_days) && place.off_days.length > 0) {
        if (place.off_days.includes(targetKorFull) || place.off_days.includes(targetKorDay)) {
          isClosedResult = true;
        }
      }
      // 5. Check "매주 일" style (boundary check to prevent matching inside "월요일")
      else {
        const singleDayRegex = new RegExp(`(?:매주|매월|매달)?\\s*${targetKorDay}\\s*(?:요일|휴무)`);
        if (singleDayRegex.test(rawText)) {
          isClosedResult = true;
        }
      }
    }

    console.log("=== 휴무일 판별 디버깅 ===");
    console.log("1. 스케줄러 선택 날짜:", dateStr);
    console.log("2. 계산된 요일:", `${targetKorDay} (${targetDayOfWeek})`);
    console.log("3. 장소 이름:", place.name);
    console.log("4. 장소의 휴무 데이터(off_days/rules):", place.off_days || place.dayOffs || place.dayOffRaw);
    console.log("5. 최종 휴무 판별 결과(isClosed):", isClosedResult);
    console.log("=========================");

    return isClosedResult;
  } catch (e) {
    return false;
  }
}

/**
 * Validates whether a place scheduled on a specific date is actually closed
 */
export function validateScheduledPlace(
  place: Place,
  weekday: DayOfWeek,
  dateStr?: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const isClosed = dateStr
    ? isPlaceClosedOnDate(place, dateStr)
    : !place.isEveryday && place.dayOffs.includes(weekday);

  if (isClosed) {
    const weekdayKorean = {
      Mon: '월요일',
      Tue: '화요일',
      Wed: '수요일',
      Thu: '목요일',
      Fri: '금요일',
      Sat: '토요일',
      Sun: '일요일',
    }[weekday];

    issues.push({
      type: 'DAY_OFF',
      severity: 'ERROR',
      message: `⚠️ ${dateStr || ''} (${weekdayKorean})은 ${place.name}의 실제 정기 휴무일입니다!`,
    });
  }

  return issues;
}
