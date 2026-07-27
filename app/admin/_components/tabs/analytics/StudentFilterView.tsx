'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Download, Eye, Star } from 'lucide-react';
import { downloadCsv } from '@/lib/csv';
import { WorkshopAnalyticsRow } from '@/types';
import { aggregateStudents, ModuleStatus, StudentAggregateRow } from './filterUtils';

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  );
}

const MODULE_STATUS_STYLE: Record<ModuleStatus, string> = {
  PRESENT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  ABSENT: 'bg-red-500/15 text-red-400 border-red-500/30',
  FAIL: 'bg-red-500/15 text-red-400 border-red-500/30',
  'N/A': 'bg-white/5 text-white/30 border-white/10',
};

function ModuleStatusBadge({ status }: { status: ModuleStatus | undefined }) {
  if (!status) return <span className="text-white/20">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${MODULE_STATUS_STYLE[status]}`}>
      {status === 'PRESENT' ? 'Present' : status === 'ABSENT' ? 'Absent' : status === 'FAIL' ? 'Fail' : 'N/A'}
    </span>
  );
}

export default function StudentFilterView({ rows, selectedCourse }: { rows: WorkshopAnalyticsRow[]; selectedCourse?: string }) {
  const [selected, setSelected] = useState<StudentAggregateRow | null>(null);

  const students = useMemo(() => aggregateStudents(rows), [rows]);

  // One column per distinct module name — only shown once a single course is
  // selected, otherwise module names from every course would mix into one
  // meaningless flat list.
  const moduleNames = useMemo(
    () =>
      selectedCourse
        ? Array.from(new Set(rows.map((r) => r.moduleName).filter((m) => m && m !== '—'))).sort()
        : [],
    [rows, selectedCourse],
  );

  const metrics = useMemo(() => {
    const withAttendance = students.filter((s) => s.attendancePct != null);
    const avgAttendance = withAttendance.length
      ? Math.round(withAttendance.reduce((sum, s) => sum + (s.attendancePct as number), 0) / withAttendance.length)
      : null;
    const withScore = students.filter((s) => s.avgScorePct != null);
    const avgScore = withScore.length
      ? Math.round(withScore.reduce((sum, s) => sum + (s.avgScorePct as number), 0) / withScore.length)
      : null;
    return {
      totalStudents: students.length,
      avgAttendance: avgAttendance != null ? `${avgAttendance}%` : '—',
      avgScore: avgScore != null ? `${avgScore}%` : '—',
    };
  }, [students]);

  const exportCSV = () => {
    downloadCsv(
      students.map((s) => ({
        Name: s.name,
        'Roll No': s.rollNo,
        Department: s.department,
        Programme: s.programme,
        Batch: s.batches.join(', ') || '—',
        Courses: s.courses.join(', ') || '—',
        Events: s.eventsCount,
        'Attendance %': s.attendancePct != null ? `${s.attendancePct}%` : '—',
        'Avg Score %': s.avgScorePct != null ? `${s.avgScorePct}%` : '—',
        'Avg Rating': s.avgRating ?? '—',
        ...Object.fromEntries(moduleNames.map((m) => [m, s.moduleStatus[m] ?? '—'])),
      })),
      'student-analytics',
    );
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Students
        </button>
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div>
            <h4 className="text-xl font-bold text-white">{selected.name}</h4>
            <p className="text-primary text-sm mt-1">{selected.rollNo} · {selected.department} · {selected.programme}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Events', value: selected.eventsCount },
              { label: 'Attendance', value: selected.attendancePct != null ? `${selected.attendancePct}%` : '—' },
              { label: 'Avg Score', value: selected.avgScorePct != null ? `${selected.avgScorePct}%` : '—' },
              { label: 'Avg Rating', value: selected.avgRating != null ? `${selected.avgRating} / 5` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-white/40 text-xs mb-1">{label}</p>
                <p className="text-white font-semibold text-sm">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-white/5">
                    {['Workshop', 'Course', 'Date', 'Batch', 'Attendance', 'Score', 'Rating'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-white/40 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.history.map((h, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{h.workshopName}</td>
                      <td className="px-3 py-2.5 text-white/60">{h.courseName}</td>
                      <td className="px-3 py-2.5 text-white/60">{new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-3 py-2.5 text-white/60">{h.batch}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          h.attendanceStatus === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : h.attendanceStatus === 'ABSENT' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : h.attendanceStatus === 'EXCUSED' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                            : 'bg-white/5 text-white/30 border-white/10'
                        }`}>
                          {h.attendanceStatus === 'NOT_MARKED' ? 'N/A' : h.attendanceStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-white/70 font-semibold">
                        {h.score != null ? `${h.score}/${h.maxScore ?? '?'}` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {h.rating ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-yellow-400 font-semibold">{h.rating}</span>
                          </div>
                        ) : <span className="text-white/30">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {students.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all text-sm font-semibold"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label="Unique Students" value={metrics.totalStudents} />
        <MetricCard label="Avg Attendance" value={metrics.avgAttendance} />
        <MetricCard label="Avg Score" value={metrics.avgScore} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">Student Roster</h4>
          {!selectedCourse && (
            <p className="text-[11px] text-white/35">Select a course above to see per-module attendance columns</p>
          )}
        </div>
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', 'Roll No', 'Department', 'Batch', 'Events', 'Attendance', 'Avg Score', 'Avg Rating', ...moduleNames, ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-white/40 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={9 + moduleNames.length} className="text-center py-12 text-white/30">No students match the current filter</td>
                  </tr>
                ) : students.map((s) => (
                  <tr
                    key={s.userId}
                    className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{s.name}</td>
                    <td className="px-4 py-3 text-white/60 font-mono">{s.rollNo}</td>
                    <td className="px-4 py-3 text-white/60">{s.department}</td>
                    <td className="px-4 py-3 text-white/60">{s.batches.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-white/70 font-semibold">{s.eventsCount}</td>
                    <td className="px-4 py-3 text-white/70">{s.attendancePct != null ? `${s.attendancePct}%` : '—'}</td>
                    <td className="px-4 py-3 text-white/70">{s.avgScorePct != null ? `${s.avgScorePct}%` : '—'}</td>
                    <td className="px-4 py-3">
                      {s.avgRating != null ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-yellow-400 font-semibold">{s.avgRating}</span>
                        </div>
                      ) : <span className="text-white/30">—</span>}
                    </td>
                    {moduleNames.map((m) => (
                      <td key={m} className="px-4 py-3">
                        <ModuleStatusBadge status={s.moduleStatus[m]} />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-1 text-primary hover:text-primary/80 text-xs font-medium">
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
