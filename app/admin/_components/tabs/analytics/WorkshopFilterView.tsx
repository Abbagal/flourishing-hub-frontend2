'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Download, Eye, Search, Star } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import toast from 'react-hot-toast';
import { WorkshopAnalyticsRow } from '@/types';

const CHECK_IN_LABEL: Record<string, string> = {
  NOT_CHECKED_IN: 'Not Checked-in',
  CHECKED_IN_PENDING: 'Checked-in (Pending)',
  CHECKED_IN_VERIFIED: 'Checked-in (Verified)',
  CHECKED_IN_REJECTED: 'Checked-in (Rejected)',
};

// Final attendance status when no explicit AttendanceRecord exists yet:
// checked in but unverified stays "Attendance Verification In-progress"
// indefinitely (no auto-timeout); never checked in at all is Absent.
function finalAttendanceLabel(s: any): string {
  if (s.attendanceStatus !== 'NOT_MARKED') return s.attendanceStatus;
  return s.hasCheckedIn ? 'Attendance Verification In-progress' : 'ABSENT';
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  );
}

interface WorkshopFilterViewProps {
  rows: WorkshopAnalyticsRow[];
  allRows: WorkshopAnalyticsRow[];
  selectedAnalyticsEvent: any | null;
  setSelectedAnalyticsEvent: (event: any | null) => void;
}

export default function WorkshopFilterView({ rows, allRows, selectedAnalyticsEvent, setSelectedAnalyticsEvent }: WorkshopFilterViewProps) {
  const [markingUserId, setMarkingUserId] = useState<string | null>(null);
  const [rollSearch, setRollSearch] = useState('');
  const [rollProfile, setRollProfile] = useState<{ name: string; rollNo: string; records: any[] } | null>(null);
  // When on, the next Present/Absent/Excused click records this as coming
  // from the physical sign-in sheet (its own analytics column) instead of a
  // generic manual correction — see physicalSheetStatus in types/index.ts.
  const [markFromPhysicalSheet, setMarkFromPhysicalSheet] = useState(false);

  const handleMarkAttendance = async (userId: string, status: 'PRESENT' | 'ABSENT' | 'EXCUSED') => {
    if (!selectedAnalyticsEvent?.id || !userId) return;
    setMarkingUserId(userId);
    try {
      await apiCall(`/event-operations/${selectedAnalyticsEvent.id}/attendance`, {
        method: 'POST',
        body: { userId, status, source: markFromPhysicalSheet ? 'PHYSICAL_SHEET' : 'admin-analytics' },
      });
      setSelectedAnalyticsEvent({
        ...selectedAnalyticsEvent,
        students: (selectedAnalyticsEvent.students || []).map((s: any) =>
          s.userId === userId
            ? { ...s, attendanceStatus: status, ...(markFromPhysicalSheet ? { physicalSheetStatus: status === 'EXCUSED' ? s.physicalSheetStatus : status } : {}) }
            : s
        ),
        totalAttended: (selectedAnalyticsEvent.students || []).filter((s: any) =>
          s.userId === userId ? status === 'PRESENT' : s.attendanceStatus === 'PRESENT'
        ).length,
      });
      toast.success('Attendance updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update attendance');
    } finally {
      setMarkingUserId(null);
    }
  };

  /* ── Aggregate metrics (over the shared-filtered rows) ── */
  const metrics = useMemo(() => {
    const uniqueStudents = Array.from(new Set(
      rows.flatMap((r) => (r.students || []).map((s: any) => s.rollNo).filter(Boolean)),
    ));
    const ratedRows = rows.filter((r) => r.avgRating);
    const avgRating = ratedRows.length
      ? ratedRows.reduce((sum, r) => sum + Number(r.avgRating), 0) / ratedRows.length
      : null;
    const totalPassed = rows.reduce((sum, r) => sum + (r.totalAttended || 0), 0);
    const totalRegistered = rows.reduce((sum, r) => sum + (r.totalRegistered || 0), 0);
    return {
      totalStudents: uniqueStudents.length || totalRegistered,
      totalEvents: rows.length,
      avgRating: avgRating ? `${avgRating.toFixed(2)} / 5.0` : '—',
      passRate: totalRegistered ? `${Math.round((totalPassed / totalRegistered) * 100)}%` : '—',
    };
  }, [rows]);

  /* ── Facilitator telemetry ── */
  const facilitatorMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (r.instructorName && r.instructorName !== '—') map.set(r.instructorName, (map.get(r.instructorName) || 0) + 1);
      if (r.associateInstructorName && r.associateInstructorName !== '—') {
        map.set(r.associateInstructorName, (map.get(r.associateInstructorName) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  /* ── Student roll lookup — always searches the full dataset, independent of the active filter bar ── */
  const handleRollLookup = () => {
    const query = rollSearch.trim().toLowerCase();
    if (!query) return;
    const records: any[] = [];
    allRows.forEach((row) => {
      (row.students || []).forEach((s: any) => {
        if (s.rollNo?.toLowerCase() === query) {
          records.push({ ...s, workshopName: row.workshopName, courseName: row.courseName, date: row.date });
        }
      });
    });
    if (records.length > 0) {
      setRollProfile({ name: records[0].name, rollNo: records[0].rollNo, records });
    } else {
      setRollProfile(null);
    }
  };

  /* ── CSV export ── */
  const exportRegistryCSV = () => {
    const csvRows = rows.map((r) => {
      const passed = r.totalAttended || 0;
      const failed = (r.students || []).filter(
        (s: any) => s.quizCompleted && s.attendanceStatus !== 'PRESENT',
      ).length;
      return {
        Workshop: r.workshopName,
        Course: r.courseName || '—',
        'Assigned Conductor': r.associateInstructorName !== '—' ? r.associateInstructorName : r.instructorName,
        'Check-In': passed + failed,
        Passed: passed,
        Failed: failed,
        'Avg Rating': r.avgRating || '—',
      };
    });
    downloadCsv(csvRows, 'workshop-performance');
  };

  /* ══════════════════════════════════════════════════════════
     WORKSHOP DETAIL VIEW
  ══════════════════════════════════════════════════════════ */
  if (selectedAnalyticsEvent) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedAnalyticsEvent(null)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Analytics
        </button>
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div>
            <h4 className="text-xl font-bold text-white">{selectedAnalyticsEvent.workshopName}</h4>
            <p className="text-primary text-sm mt-1">{selectedAnalyticsEvent.courseName}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Date', value: new Date(selectedAnalyticsEvent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
              { label: 'Batch', value: selectedAnalyticsEvent.batch },
              { label: 'Instructor', value: selectedAnalyticsEvent.instructorName },
              { label: 'Avg Rating', value: selectedAnalyticsEvent.avgRating ? `${selectedAnalyticsEvent.avgRating} / 5` : 'N/A' },
              { label: 'Registered', value: selectedAnalyticsEvent.totalRegistered },
              { label: 'Attended', value: selectedAnalyticsEvent.totalAttended },
              { label: 'Absent', value: selectedAnalyticsEvent.totalAbsent },
              { label: 'Venue', value: selectedAnalyticsEvent.venue },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-white/40 text-xs mb-1">{label}</p>
                <p className="text-white font-semibold text-sm">{value}</p>
              </div>
            ))}
          </div>

          {(selectedAnalyticsEvent.associateInstructorName !== '—' || selectedAnalyticsEvent.volunteerNames?.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {selectedAnalyticsEvent.associateInstructorName !== '—' && (
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
                  <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">Associate Instructor</p>
                  <p className="text-white text-sm font-medium">{selectedAnalyticsEvent.associateInstructorName}</p>
                </div>
              )}
              {selectedAnalyticsEvent.volunteerNames?.length > 0 && (
                <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/15">
                  <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-1">Volunteers ({selectedAnalyticsEvent.volunteerNames.length})</p>
                  <p className="text-white text-sm">{selectedAnalyticsEvent.volunteerNames.join(', ')}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-white font-semibold text-sm">
                Registered Students ({(selectedAnalyticsEvent.students || []).length})
              </h5>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-white/50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={markFromPhysicalSheet}
                    onChange={(e) => setMarkFromPhysicalSheet(e.target.checked)}
                    className="accent-amber-400"
                  />
                  Mark from physical sheet
                </label>
                <button
                  onClick={() => {
                    const csvRows = (selectedAnalyticsEvent.students || []).map((s: any) => ({
                      Name: s.name,
                      Email: s.email,
                      'Roll No': s.rollNo,
                      Batch: s.batch,
                      'Check-in Status': CHECK_IN_LABEL[s.checkInStatus] ?? 'Not Checked-in',
                      'Physical Sheet Status': s.physicalSheetStatus ?? '—',
                      'Final Attendance Status': finalAttendanceLabel(s),
                      'Quiz Completed': s.quizCompleted ? 'Yes' : 'No',
                      Score: s.score != null ? `${s.score}/${s.maxScore ?? '?'}` : '—',
                      Rating: s.rating ?? '—',
                      'Registration Status': s.registrationStatus,
                    }));
                    downloadCsv(csvRows, `${selectedAnalyticsEvent.workshopName}-students`);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-all text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-white/5">
                      {['Name', 'Roll No', 'Batch', 'Check-in Status', 'Physical Sheet', 'Final Attendance', 'Mark Attendance', 'Quiz', 'Score', 'Rating'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-white/40 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAnalyticsEvent.students || []).length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-8 text-white/30">No students registered</td></tr>
                    ) : (selectedAnalyticsEvent.students || []).map((s: any, i: number) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.name}</td>
                        <td className="px-3 py-2.5 text-white/60 font-mono">{s.rollNo}</td>
                        <td className="px-3 py-2.5 text-white/60">{s.batch}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                            s.checkInStatus === 'CHECKED_IN_VERIFIED' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : s.checkInStatus === 'CHECKED_IN_PENDING' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : s.checkInStatus === 'CHECKED_IN_REJECTED' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-white/5 text-white/30 border-white/10'
                          }`}>
                            {CHECK_IN_LABEL[s.checkInStatus] ?? 'Not Checked-in'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            s.physicalSheetStatus === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : s.physicalSheetStatus === 'ABSENT' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-white/5 text-white/30 border-white/10'
                          }`}>
                            {s.physicalSheetStatus ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                            s.attendanceStatus === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : s.attendanceStatus === 'EXCUSED' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                              // A self check-in sits unverified (no AttendanceRecord yet) until
                              // staff reviews it — same NOT_MARKED-but-hasCheckedIn case the
                              // Student Filter tab already surfaces as "Attendance Verification In-progress"
                              // via computeModuleStatus in filterUtils.ts. No auto-timeout any
                              // more (the old 5-day auto-reject cron is gone) — this stays until
                              // a human verifies. Not checked in at all (and no physical sheet
                              // data) is a real Absent, not an ambiguous N/A.
                              : s.attendanceStatus === 'NOT_MARKED' && s.hasCheckedIn ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          }`}>
                            {finalAttendanceLabel(s)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {s.userId ? (
                            <div className="flex items-center gap-1">
                              {(['PRESENT', 'ABSENT', 'EXCUSED'] as const).map((st) => (
                                <button
                                  key={st}
                                  disabled={markingUserId === s.userId}
                                  onClick={() => handleMarkAttendance(s.userId, st)}
                                  title={st === 'PRESENT' ? 'Mark Present' : st === 'ABSENT' ? 'Mark Absent' : 'Mark Excused'}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all disabled:opacity-40 ${
                                    s.attendanceStatus === st
                                      ? st === 'PRESENT' ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                                        : st === 'ABSENT' ? 'bg-red-500/25 text-red-300 border-red-500/50'
                                        : 'bg-yellow-500/25 text-yellow-300 border-yellow-500/50'
                                      : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  {st === 'PRESENT' ? 'P' : st === 'ABSENT' ? 'A' : 'E'}
                                </button>
                              ))}
                            </div>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            s.quizCompleted ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-white/5 text-white/30 border-white/10'
                          }`}>
                            {s.quizCompleted ? 'Done' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-white/70 font-semibold">
                          {s.score != null ? `${s.score}/${s.maxScore ?? '?'}` : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {s.rating ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-yellow-400 font-semibold">{s.rating}</span>
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
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MAIN WORKSHOP CONSOLE
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={exportRegistryCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all text-sm font-semibold"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Students" value={metrics.totalStudents} />
        <MetricCard label="Active Events" value={metrics.totalEvents} />
        <MetricCard label="Avg Form Rating" value={metrics.avgRating} />
        <MetricCard label="Avg Pass Rate" value={metrics.passRate} />
      </div>

      {/* ── Performance Registry Table ── */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Consolidated Track Performance Registry</h4>
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['Workshop Session', 'Assigned Conductor', 'Batch', 'Date', 'Time', 'Check-In', 'Passed', 'Failed', 'Avg Rating', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-white/40 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-white/30">No completed workshops match the current filter</td>
                  </tr>
                ) : rows.map((row, i) => {
                  const passed = row.totalAttended || 0;
                  const failed = (row.students || []).filter(
                    (s: any) => s.quizCompleted && s.attendanceStatus !== 'PRESENT',
                  ).length;
                  const checkIn = passed + failed;
                  const timeFmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
                  return (
                    <tr
                      key={i}
                      className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => setSelectedAnalyticsEvent(row)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{row.workshopName}</p>
                        <p className="text-white/35 text-[10px] mt-0.5">{row.courseName}</p>
                      </td>
                      <td className="px-4 py-3 text-white/60">{row.associateInstructorName !== '—' ? row.associateInstructorName : row.instructorName}</td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">{row.batch || '—'}</td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                        {row.date ? new Date(row.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                        {row.date && row.endAt
                          ? `${new Date(row.date).toLocaleTimeString('en-IN', timeFmt)} – ${new Date(row.endAt).toLocaleTimeString('en-IN', timeFmt)}`
                          : row.date ? new Date(row.date).toLocaleTimeString('en-IN', timeFmt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-white/70 font-semibold">{checkIn > 0 ? `${checkIn} Stud` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-emerald-400 font-semibold">{passed > 0 ? `${passed} Users` : '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-red-400 font-semibold">{failed > 0 ? `${failed} Users` : '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.avgRating ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-yellow-400 font-semibold">{row.avgRating} / 5.0</span>
                          </div>
                        ) : <span className="text-white/30">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button className="flex items-center gap-1 text-primary hover:text-primary/80 text-xs font-medium">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Facilitator Telemetry + Student Lookup ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Facilitator Engagement Telemetry</h4>
          <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
            {facilitatorMap.length === 0 ? (
              <p className="text-center py-8 text-white/30 text-xs">No facilitator data</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-white/40 uppercase tracking-wider">Instructor Name</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-white/40 uppercase tracking-wider">Workshops Run</th>
                  </tr>
                </thead>
                <tbody>
                  {facilitatorMap.map(([name, count], i) => (
                    <tr key={i} className="border-b border-white/[0.03]">
                      <td className="px-4 py-2.5 text-white font-medium">{name}</td>
                      <td className="px-4 py-2.5 text-primary font-semibold">{count} Session{count !== 1 ? 's' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Student Timeline Lookup</h4>
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  value={rollSearch}
                  onChange={(e) => { setRollSearch(e.target.value); if (!e.target.value) setRollProfile(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleRollLookup()}
                  placeholder="Search student roll number..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <button
                onClick={handleRollLookup}
                className="px-4 py-2 rounded-xl bg-primary/15 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/25 transition-colors"
              >
                Search
              </button>
            </div>

            {rollProfile === null && rollSearch.trim() && (
              <p className="text-xs text-red-400/70">No records found for &quot;{rollSearch}&quot;</p>
            )}

            {rollProfile && (() => {
              const presentCount = rollProfile.records.filter((r) => r.attendanceStatus === 'PRESENT').length;
              const scoredRecords = rollProfile.records.filter((r) => r.score != null);
              const avgScore = scoredRecords.length
                ? (scoredRecords.reduce((sum, r) => sum + r.score, 0) / scoredRecords.length).toFixed(1)
                : null;
              return (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">
                        Targeting Profile: {rollProfile.name} ({rollProfile.rollNo})
                      </p>
                      <p className="text-white/50 text-xs mt-0.5">
                        Attendance Log: {presentCount}/{rollProfile.records.length} Present
                        {avgScore ? ` · Avg Score: ${avgScore}/5` : ''}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                      presentCount === rollProfile.records.length
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}>
                      {presentCount === rollProfile.records.length ? 'Full Attend.' : 'Partial'}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {rollProfile.records.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-white/5 last:border-0">
                        <span className="text-white/60 truncate max-w-[60%]">{r.workshopName}</span>
                        <span className={`font-semibold ${
                          r.attendanceStatus === 'PRESENT' ? 'text-emerald-400'
                            : r.attendanceStatus === 'NOT_MARKED' && r.hasCheckedIn ? 'text-amber-400'
                            : 'text-red-400'
                        }`}>
                          {finalAttendanceLabel(r)}
                          {r.score != null ? ` · ${r.score}/5` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
