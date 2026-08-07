import { AnalyticsFilterState, AnalyticsStudentEntry, WorkshopAnalyticsRow } from '@/types';

export const emptyAnalyticsFilters: AnalyticsFilterState = {
  course: '',
  topic: '',
  instructor: '',
  batch: '',
  dateFrom: '',
  dateTo: '',
  attendanceStatus: '',
  department: '',
  minScorePct: '',
  maxScorePct: '',
};

/**
 * Applies every filter field identically regardless of which sub-tab is consuming the
 * result — keeps Workshop/Student/Instructor views from drifting on filter semantics.
 * Row-level fields (course/topic/instructor/batch/date) decide whether a workshop row
 * survives at all; student-level fields (attendance/department/score) narrow each
 * surviving row's `students` array, and a row is then dropped if that leaves it empty.
 */
export function filterAnalyticsRows(
  rows: WorkshopAnalyticsRow[],
  filters: AnalyticsFilterState,
): WorkshopAnalyticsRow[] {
  const dateFromTs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  const dateToTs = filters.dateTo ? new Date(filters.dateTo).getTime() : null;
  const minPct = filters.minScorePct !== '' ? Number(filters.minScorePct) : null;
  const maxPct = filters.maxScorePct !== '' ? Number(filters.maxScorePct) : null;
  const needsStudentFilter = Boolean(filters.attendanceStatus || filters.department || minPct !== null || maxPct !== null);

  const matchesStudent = (s: AnalyticsStudentEntry) => {
    if (filters.attendanceStatus && s.attendanceStatus !== filters.attendanceStatus) return false;
    if (filters.department && s.department !== filters.department) return false;
    if (minPct !== null || maxPct !== null) {
      if (s.score == null || s.maxScore == null || s.maxScore === 0) return false;
      const pct = (s.score / s.maxScore) * 100;
      if (minPct !== null && pct < minPct) return false;
      if (maxPct !== null && pct > maxPct) return false;
    }
    return true;
  };

  const out: WorkshopAnalyticsRow[] = [];
  for (const row of rows) {
    if (filters.course && row.courseName !== filters.course) continue;
    if (filters.topic && row.workshopName !== filters.topic) continue;
    if (filters.instructor && row.instructorName !== filters.instructor && row.associateInstructorName !== filters.instructor) continue;
    if (filters.batch && row.batch !== filters.batch) continue;
    if (dateFromTs !== null || dateToTs !== null) {
      const rowTs = new Date(row.date).getTime();
      if (dateFromTs !== null && rowTs < dateFromTs) continue;
      if (dateToTs !== null && rowTs > dateToTs) continue;
    }

    if (!needsStudentFilter) {
      out.push(row);
      continue;
    }
    const students = row.students.filter(matchesStudent);
    if (students.length > 0) out.push({ ...row, students });
  }
  return out;
}

export interface StudentHistoryEntry {
  workshopName: string;
  courseName: string;
  date: string;
  batch: string;
  attendanceStatus: AnalyticsStudentEntry['attendanceStatus'];
  score: number | null;
  maxScore: number | null;
  rating: number | null;
}

export type ModuleStatus = 'ABSENT' | 'PENDING' | 'PRESENT' | 'FAIL' | 'N/A';

// Pending: checked in but the instructor hasn't reviewed the check-in yet
//   (no AttendanceRecord exists at all — distinct from a real Absent, which
//   only happens when an instructor explicitly rejects, or the 5-day
//   auto-reject grace period lapses with no review). Since quiz/feedback/
//   rating now unlock on session-time + check-in alone (not verification —
//   see operation.service.js's isPastMidSession/hasCheckedIn), a student can
//   be fully "Pending" here and still have completed everything.
// Absent: instructor explicitly marked the check-in ABSENT/REJECTED (or
//   never checked in at all) for that module's event.
// N/A: attended, course has quiz-based grading enabled, but no in-built-quiz
//   submission exists for this student on this module (nothing to grade).
// Fail: attended, course has quiz-based grading, quizScore < 4 (out of 10).
// Present: attended and either the course has no quiz-based grading at all,
//   or quizScore >= 4.
function computeModuleStatus(s: AnalyticsStudentEntry, row: WorkshopAnalyticsRow): ModuleStatus {
  if (s.attendanceStatus === 'NOT_MARKED') return 'PENDING';
  if (s.attendanceStatus !== 'PRESENT') return 'ABSENT';
  if (!row.courseHasQuiz) return 'PRESENT';
  if (s.quizScore == null) return 'N/A';
  return s.quizScore >= 4 ? 'PRESENT' : 'FAIL';
}

export interface StudentAggregateRow {
  userId: string;
  name: string;
  email: string;
  rollNo: string;
  department: string;
  programme: string;
  batches: string[];
  courses: string[];
  eventsCount: number;
  presentCount: number;
  markedCount: number;
  attendancePct: number | null;
  avgScorePct: number | null;
  avgRating: number | null;
  history: StudentHistoryEntry[];
  // Keyed by module name (e.g. "M1: Identifying Psychological Concerns in
  // Students") — a module the student has no row for at all is simply absent
  // from this map (rendered as "—" in the UI, distinct from 'ABSENT').
  moduleStatus: Record<string, ModuleStatus>;
}

/** Dedupes the (already filtered) rows' nested students by userId, aggregating across every matching appearance. */
export function aggregateStudents(rows: WorkshopAnalyticsRow[]): StudentAggregateRow[] {
  const map = new Map<string, StudentAggregateRow>();

  rows.forEach((row) => {
    row.students.forEach((s) => {
      if (!s.userId) return;
      let agg = map.get(s.userId);
      if (!agg) {
        agg = {
          userId: s.userId,
          name: s.name,
          email: s.email,
          rollNo: s.rollNo,
          department: s.department || '—',
          programme: s.programme || '—',
          batches: [],
          courses: [],
          eventsCount: 0,
          presentCount: 0,
          markedCount: 0,
          attendancePct: null,
          avgScorePct: null,
          avgRating: null,
          history: [],
          moduleStatus: {},
        };
        map.set(s.userId, agg);
      }
      agg.eventsCount += 1;
      if (s.attendanceStatus !== 'NOT_MARKED') {
        agg.markedCount += 1;
        if (s.attendanceStatus === 'PRESENT') agg.presentCount += 1;
      }
      if (s.batch && s.batch !== '—' && !agg.batches.includes(s.batch)) agg.batches.push(s.batch);
      if (row.courseName && row.courseName !== '—' && !agg.courses.includes(row.courseName)) agg.courses.push(row.courseName);
      if (row.moduleName && row.moduleName !== '—') {
        agg.moduleStatus[row.moduleName] = computeModuleStatus(s, row);
      }
      agg.history.push({
        workshopName: row.workshopName,
        courseName: row.courseName,
        date: row.date,
        batch: s.batch,
        attendanceStatus: s.attendanceStatus,
        score: s.score,
        maxScore: s.maxScore,
        rating: s.rating,
      });
    });
  });

  return Array.from(map.values())
    .map((agg) => {
      // Weighted average (sum of scores / sum of max scores), not a mean of
      // per-event percentages — avoids overweighting a low-maxScore event.
      const scored = agg.history.filter((h) => h.score != null && h.maxScore != null && h.maxScore > 0);
      const scoreSum = scored.reduce((sum, h) => sum + (h.score as number), 0);
      const maxSum = scored.reduce((sum, h) => sum + (h.maxScore as number), 0);
      const rated = agg.history.filter((h) => h.rating != null);
      return {
        ...agg,
        attendancePct: agg.markedCount > 0 ? Math.round((agg.presentCount / agg.markedCount) * 100) : null,
        avgScorePct: maxSum > 0 ? Math.round((scoreSum / maxSum) * 100) : null,
        avgRating: rated.length
          ? Number((rated.reduce((sum, h) => sum + (h.rating as number), 0) / rated.length).toFixed(1))
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface InstructorAggregateRow {
  key: string;
  instructorId: string | null;
  name: string;
  workshopsCount: number;
  studentsTaught: number;
  avgRating: number | null;
  avgPassRate: number | null;
  courses: string[];
  batches: string[];
  workshops: WorkshopAnalyticsRow[];
}

/**
 * Groups the (already filtered) rows by instructor, counting a workshop toward
 * whichever person conducted it as INSTRUCTOR and/or ASSOCIATE_INSTRUCTOR — a row
 * with neither role assigned lands in an explicit "Unassigned" bucket rather than
 * being silently dropped, so totals still reconcile with the Workshop tab.
 */
export function aggregateInstructors(rows: WorkshopAnalyticsRow[]): InstructorAggregateRow[] {
  const map = new Map<string, InstructorAggregateRow>();

  const addAppearance = (id: string | null, name: string, row: WorkshopAnalyticsRow) => {
    const hasName = Boolean(name && name !== '—');
    const key = id || (hasName ? `name:${name}` : 'unassigned');
    let agg = map.get(key);
    if (!agg) {
      agg = {
        key,
        instructorId: id,
        name: hasName ? name : 'Unassigned',
        workshopsCount: 0,
        studentsTaught: 0,
        avgRating: null,
        avgPassRate: null,
        courses: [],
        batches: [],
        workshops: [],
      };
      map.set(key, agg);
    }
    if (!agg.workshops.some((w) => w.id === row.id)) {
      agg.workshops.push(row);
      agg.workshopsCount += 1;
      if (row.courseName && row.courseName !== '—' && !agg.courses.includes(row.courseName)) agg.courses.push(row.courseName);
      if (row.batch && row.batch !== '—' && !agg.batches.includes(row.batch)) agg.batches.push(row.batch);
    }
  };

  rows.forEach((row) => {
    const hasInstructor = Boolean(row.instructorId || (row.instructorName && row.instructorName !== '—'));
    const hasAssociate = Boolean(row.associateInstructorId || (row.associateInstructorName && row.associateInstructorName !== '—'));
    if (hasInstructor) addAppearance(row.instructorId, row.instructorName, row);
    if (hasAssociate) addAppearance(row.associateInstructorId, row.associateInstructorName, row);
    if (!hasInstructor && !hasAssociate) addAppearance(null, '—', row);
  });

  return Array.from(map.values())
    .map((agg) => {
      const studentIds = new Set<string>();
      let ratingSum = 0;
      let ratingCount = 0;
      let passSum = 0;
      let registeredSum = 0;
      agg.workshops.forEach((w) => {
        w.students.forEach((s) => { if (s.userId) studentIds.add(s.userId); });
        if (w.avgRating != null) {
          ratingSum += Number(w.avgRating);
          ratingCount += 1;
        }
        passSum += w.totalAttended || 0;
        registeredSum += w.totalRegistered || 0;
      });
      return {
        ...agg,
        studentsTaught: studentIds.size,
        avgRating: ratingCount ? Number((ratingSum / ratingCount).toFixed(1)) : null,
        avgPassRate: registeredSum > 0 ? Math.round((passSum / registeredSum) * 100) : null,
      };
    })
    .sort((a, b) => b.workshopsCount - a.workshopsCount);
}
