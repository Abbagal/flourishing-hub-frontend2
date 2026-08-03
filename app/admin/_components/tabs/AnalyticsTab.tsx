'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet, Users, BookOpen, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { AnalyticsFilterState, WorkshopAnalyticsRow } from '@/types';
import AnalyticsFilterBar from './analytics/AnalyticsFilterBar';
import WorkshopFilterView from './analytics/WorkshopFilterView';
import StudentFilterView from './analytics/StudentFilterView';
import InstructorFilterView from './analytics/InstructorFilterView';
import { emptyAnalyticsFilters, filterAnalyticsRows } from './analytics/filterUtils';

interface AnalyticsTabProps {
  analyticsLoading: boolean;
  analyticsData: WorkshopAnalyticsRow[];
  selectedAnalyticsEvent: any | null;
  setSelectedAnalyticsEvent: (event: any | null) => void;
  courses: any[];
}

type SubTab = 'workshop' | 'student' | 'instructor';

const SUB_TABS: { id: SubTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'workshop', label: 'Workshop-Level Filter', icon: BookOpen },
  { id: 'student', label: 'Student-Level Filter', icon: Users },
  { id: 'instructor', label: 'Instructor-Level Filter', icon: GraduationCap },
];

export default function AnalyticsTab({
  analyticsLoading,
  analyticsData,
  selectedAnalyticsEvent,
  setSelectedAnalyticsEvent,
  courses,
}: AnalyticsTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('workshop');
  const [filters, setFilters] = useState<AnalyticsFilterState>(emptyAnalyticsFilters);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingResponses, setExportingResponses] = useState(false);

  const filteredRows = useMemo(() => filterAnalyticsRows(analyticsData, filters), [analyticsData, filters]);

  const exportMasterExcel = async () => {
    setExportingExcel(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${baseUrl}/admin/analytics/export-excel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flourishing-hub-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel report downloaded!');
    } catch {
      toast.error('Failed to export Excel report');
    } finally {
      setExportingExcel(false);
    }
  };

  // New, additive export — student-wise in-built Quiz score, in-built
  // Feedback-form answers, and Rating, honoring the same Course/Topic/
  // Instructor/Batch filters already selected above. Independent of
  // exportMasterExcel above; doesn't touch it.
  const exportStudentResponses = async () => {
    setExportingResponses(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const params = new URLSearchParams();
      if (filters.course) params.set('course', filters.course);
      if (filters.topic) params.set('topic', filters.topic);
      if (filters.instructor) params.set('instructor', filters.instructor);
      if (filters.batch) params.set('batch', filters.batch);
      const res = await fetch(`${baseUrl}/admin/analytics/export-student-responses?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `student-responses-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Student responses exported!');
    } catch {
      toast.error('Failed to export student responses');
    } finally {
      setExportingResponses(false);
    }
  };

  const inDrillDown = subTab === 'workshop' && Boolean(selectedAnalyticsEvent);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Analytics Console</h3>
          <p className="text-xs text-white/40 mt-0.5">Course performance, facilitator telemetry & student lookup</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportStudentResponses}
            disabled={exportingResponses}
            title="Exports student-wise in-built Quiz score, in-built Feedback answers, and Rating — honoring the Course/Topic/Instructor/Batch filters below"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-all text-sm font-semibold disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exportingResponses ? 'Exporting…' : 'Export Student Responses'}
          </button>
          <button
            onClick={exportMasterExcel}
            disabled={exportingExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all text-sm font-semibold disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exportingExcel ? 'Exporting…' : 'Export Master Excel'}
          </button>
        </div>
      </div>

      {!inDrillDown && (
        <>
          <div className="flex items-center gap-2 border-b border-white/5">
            {SUB_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSubTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  subTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          <AnalyticsFilterBar
            courses={courses}
            analyticsData={analyticsData}
            filters={filters}
            onChange={setFilters}
          />
        </>
      )}

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {subTab === 'workshop' && (
            <WorkshopFilterView
              rows={filteredRows}
              allRows={analyticsData}
              selectedAnalyticsEvent={selectedAnalyticsEvent}
              setSelectedAnalyticsEvent={setSelectedAnalyticsEvent}
            />
          )}
          {subTab === 'student' && <StudentFilterView rows={filteredRows} selectedCourse={filters.course} />}
          {subTab === 'instructor' && <InstructorFilterView rows={filteredRows} />}
        </>
      )}
    </div>
  );
}
