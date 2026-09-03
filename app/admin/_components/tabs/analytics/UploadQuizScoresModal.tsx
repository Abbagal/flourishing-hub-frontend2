'use client';

import { useMemo, useState } from 'react';
import { X, Upload, FileUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { WorkshopAnalyticsRow } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface UploadResult {
  totalRows: number;
  updated: number;
  created: number;
  skipped: number;
  skippedRows: { row: number; roll: string; reason: string }[];
}

export default function UploadQuizScoresModal({
  open,
  onClose,
  courses,
  analyticsData,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  courses: any[];
  analyticsData: WorkshopAnalyticsRow[];
  onUploaded: () => void;
}) {
  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  // Only quiz-enabled courses can have a Score column, so only offer those.
  const courseOptions = useMemo(
    () => courses.filter((c) => c.hasQuiz).map((c) => ({ id: c.id, name: c.name })),
    [courses],
  );

  const selectedCourseName = courseOptions.find((c) => c.id === courseId)?.name;

  const topicOptions = useMemo(() => {
    if (!selectedCourseName) return [];
    return Array.from(
      new Set(
        analyticsData
          .filter((r) => r.courseName === selectedCourseName)
          .map((r) => r.workshopName)
          .filter((v) => v && v !== '—'),
      ),
    ).sort();
  }, [analyticsData, selectedCourseName]);

  if (!open) return null;

  const reset = () => {
    setCourseId('');
    setTopic('');
    setFile(null);
    setResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!courseId || !topic || !file) {
      toast.error('Pick a course, a topic, and a file');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('courseId', courseId);
      fd.append('topic', topic);
      const res = await fetch(`${API_BASE}/admin/analytics/quiz-scores`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Upload failed');
      setResult(data.data as UploadResult);
      const r = data.data as UploadResult;
      toast.success(`${r.created + r.updated} score${r.created + r.updated === 1 ? '' : 's'} saved`);
      onUploaded();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={close}>
      <div
        className="w-full max-w-lg rounded-2xl bg-card border border-white/10 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Upload Quiz Scores</h3>
            <p className="text-xs text-white/40 mt-0.5">One sheet per topic · columns: <span className="font-mono">Roll No</span>, <span className="font-mono">Score</span> · out of 10</p>
          </div>
          <button onClick={close} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">Course</label>
              <select
                value={courseId}
                onChange={(e) => { setCourseId(e.target.value); setTopic(''); }}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-primary/50"
              >
                <option value="">Select a course…</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {courseOptions.length === 0 && (
                <p className="text-[11px] text-amber-400/80">No quiz-enabled courses. Turn on “Has quiz” for the course first.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">Topic</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={!courseId}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-primary/50 disabled:opacity-40"
              >
                <option value="">Select a topic…</option>
                {topicOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">Score sheet (.xlsx or .csv)</label>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-dashed border-white/15 text-sm text-white/60 cursor-pointer hover:border-primary/40 transition-colors">
                <FileUp className="w-4 h-4" />
                {file ? file.name : 'Choose file…'}
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <button
              onClick={submit}
              disabled={busy || !courseId || !topic || !file}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all text-sm font-semibold disabled:opacity-40"
            >
              <Upload className="w-4 h-4" />
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-semibold">{result.created + result.updated} of {result.totalRows} rows saved</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'New', value: result.created },
                { label: 'Updated', value: result.updated },
                { label: 'Skipped', value: result.skipped },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-[11px] text-white/40">{s.label}</p>
                </div>
              ))}
            </div>
            {result.skippedRows.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5 max-h-52 overflow-y-auto">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" /> Skipped rows
                </p>
                {result.skippedRows.map((sr, i) => (
                  <p key={i} className="text-xs text-white/60">
                    <span className="font-mono text-white/40">row {sr.row}</span>
                    {sr.roll ? <> · <span className="font-mono">{sr.roll}</span></> : null} — {sr.reason}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 px-4 py-2 rounded-xl bg-white/[0.05] text-white/70 border border-white/10 hover:bg-white/[0.08] transition-all text-sm font-semibold"
              >
                Upload another
              </button>
              <button
                onClick={close}
                className="flex-1 px-4 py-2 rounded-xl bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
