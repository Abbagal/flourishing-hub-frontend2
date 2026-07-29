'use client';

import { useMemo } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { AnalyticsFilterState, WorkshopAnalyticsRow } from '@/types';
import { emptyAnalyticsFilters } from './filterUtils';

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full pl-3 pr-8 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-primary/50 transition-colors"
      >
        <option value="">{label}: All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
    </div>
  );
}

interface AnalyticsFilterBarProps {
  courses: any[];
  analyticsData: WorkshopAnalyticsRow[];
  filters: AnalyticsFilterState;
  onChange: (next: AnalyticsFilterState) => void;
}

const ATTENDANCE_OPTIONS = ['PRESENT', 'ABSENT', 'EXCUSED', 'NOT_MARKED'];

export default function AnalyticsFilterBar({ courses, analyticsData, filters, onChange }: AnalyticsFilterBarProps) {
  const set = (patch: Partial<AnalyticsFilterState>) => onChange({ ...filters, ...patch });

  /* Options only soft-narrow (Topic follows Course) — no field is ever disabled,
     so an admin can jump straight to "Instructor + Batch" without picking a course first. */
  const courseOptions = useMemo(
    () => Array.from(new Set(courses.map((c) => c.name).filter(Boolean))),
    [courses],
  );

  const topicOptions = useMemo(() => {
    const base = filters.course ? analyticsData.filter((r) => r.courseName === filters.course) : analyticsData;
    return Array.from(new Set(base.map((r) => r.workshopName).filter((v) => v && v !== '—')));
  }, [analyticsData, filters.course]);

  const instructorOptions = useMemo(() => {
    const names = new Set<string>();
    analyticsData.forEach((r) => {
      if (r.instructorName && r.instructorName !== '—') names.add(r.instructorName);
      if (r.associateInstructorName && r.associateInstructorName !== '—') names.add(r.associateInstructorName);
    });
    return Array.from(names).sort();
  }, [analyticsData]);

  // Batch narrows with Course + Topic (a module's batches are only ever the
  // batches of workshops actually filed under it) — this was previously
  // computed from the full unfiltered analyticsData, so picking a Topic
  // (module) never shrank the Batch dropdown at all.
  const batchOptionsFor = (course: string, topic: string) =>
    Array.from(new Set(
      analyticsData
        .filter((r) => (!course || r.courseName === course) && (!topic || r.workshopName === topic))
        .map((r) => r.batch)
        .filter((v) => v && v !== '—'),
    )).sort();

  const batchOptions = useMemo(
    () => batchOptionsFor(filters.course, filters.topic),
    [analyticsData, filters.course, filters.topic],
  );

  const departmentOptions = useMemo(() => {
    const depts = new Set<string>();
    analyticsData.forEach((r) => r.students.forEach((s) => { if (s.department) depts.add(s.department); }));
    return Array.from(depts).sort();
  }, [analyticsData]);

  const hasActiveFilter = Object.values(filters).some((v) => v !== '');

  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Filters</p>
        {hasActiveFilter && (
          <button
            onClick={() => onChange(emptyAnalyticsFilters)}
            className="flex items-center gap-1 text-[10px] font-semibold text-white/40 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <FilterSelect label="Course" value={filters.course} options={courseOptions} onChange={(v) => {
          const nextTopic = filters.topic && !topicOptions.includes(filters.topic) ? '' : filters.topic;
          const nextBatch = filters.batch && !batchOptionsFor(v, nextTopic).includes(filters.batch) ? '' : filters.batch;
          set({ course: v, topic: nextTopic, batch: nextBatch });
        }} />
        <FilterSelect label="Topic" value={filters.topic} options={topicOptions} onChange={(v) => {
          const nextBatch = filters.batch && !batchOptionsFor(filters.course, v).includes(filters.batch) ? '' : filters.batch;
          set({ topic: v, batch: nextBatch });
        }} />
        <FilterSelect label="Instructor" value={filters.instructor} options={instructorOptions} onChange={(v) => set({ instructor: v })} />
        <FilterSelect label="Batch" value={filters.batch} options={batchOptions} onChange={(v) => set({ batch: v })} />
        <FilterSelect label="Department" value={filters.department} options={departmentOptions} onChange={(v) => set({ department: v })} />
        <FilterSelect label="Attendance" value={filters.attendanceStatus} options={ATTENDANCE_OPTIONS} onChange={(v) => set({ attendanceStatus: v })} />
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className="w-full px-2.5 py-2 rounded-xl text-xs bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
          />
          <span className="text-white/20 text-xs">–</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            className="w-full px-2.5 py-2 rounded-xl text-xs bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Min %"
            value={filters.minScorePct}
            onChange={(e) => set({ minScorePct: e.target.value })}
            className="w-full px-2.5 py-2 rounded-xl text-xs bg-white/[0.04] border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <span className="text-white/20 text-xs">–</span>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Max %"
            value={filters.maxScorePct}
            onChange={(e) => set({ maxScorePct: e.target.value })}
            className="w-full px-2.5 py-2 rounded-xl text-xs bg-white/[0.04] border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
