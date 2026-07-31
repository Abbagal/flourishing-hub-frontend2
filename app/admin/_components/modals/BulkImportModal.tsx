'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronDown, Download, FileSpreadsheet, Upload, X, CheckCircle, Eye, AlertCircle, ArrowLeft, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface BulkImportModalProps {
  showBulkImport: boolean;
  setShowBulkImport: (v: boolean) => void;
  bulkImportFile: File | null;
  setBulkImportFile: (file: File | null) => void;
  bulkImporting: boolean;
  setBulkImporting: (v: boolean) => void;
  courses: any[];
  onImportComplete?: () => void;
}

const TEMPLATE_HEADERS = ['date', 'day', 'start time', 'end time', 'venue', 'tutorial/batch', 'instructor', 'associate instructor', 'quiz link', 'feedback link', 'workshop name'];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return ''; }
}

export default function BulkImportModal({
  showBulkImport,
  setShowBulkImport,
  bulkImportFile,
  setBulkImportFile,
  bulkImporting,
  setBulkImporting,
  courses,
  onImportComplete,
}: BulkImportModalProps) {
  const [workshopType, setWorkshopType] = useState<'compulsory' | 'optional' | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [step, setStep] = useState<'select' | 'form' | 'preview'>('select');
  const [previewEvents, setPreviewEvents] = useState<any[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const hasModuleMismatch = previewEvents.some((ev) => ev.moduleMatched === false);

  const resetState = () => {
    setWorkshopType(null);
    setSelectedCourseId('');
    setStep('select');
    setBatchCode('');
    setPreviewEvents([]);
    setPreviewing(false);
    setConfirmed(false);
    setShowConfirmDialog(false);
    setBulkImportFile(null);
  };

  useEffect(() => {
    if (!showBulkImport) resetState();
  }, [showBulkImport]);

  // Template row count is just a starting point for admins to fill in — the actual
  // import reads however many rows are present in the uploaded file, no cap applied.
  const TEMPLATE_ROW_COUNT = 20;

  const downloadTemplate = () => {
    const header = TEMPLATE_HEADERS.join(',');
    const emptyRow = TEMPLATE_HEADERS.map(() => '').join(',');
    const rows = Array(TEMPLATE_ROW_COUNT).fill(emptyRow).join('\n');
    const csv = header + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (file: File | null) => {
    setBulkImportFile(file);
    setPreviewEvents([]);
    setStep('form');
    setConfirmed(false);
  };

  const handlePreview = async () => {
    if (!bulkImportFile) return;
    // Course selection isn't marked required on the <select>, so a
    // compulsory-workshop import used to silently proceed with courseId
    // never sent — the created events had no course link, weren't findable
    // by module, and registerCourseBatchForEvent (which needs courseId) was
    // a no-op, so no student ever got auto-registered. Block it here instead.
    if (workshopType === 'compulsory' && !selectedCourseId) {
      toast.error('Select a course first — compulsory workshops need a course to auto-register students.');
      return;
    }
    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append('file', bulkImportFile);
      if (selectedCourseId) formData.append('courseId', selectedCourseId);
      if (workshopType === 'compulsory' && batchCode.trim()) formData.append('batchCode', batchCode.trim());
      if (workshopType) formData.append('workshopType', workshopType);
      if (workshopType === 'optional') formData.append('capacity', '60');

      const res = await fetch(`${API_BASE}/imports/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to parse file');
      if (!data.data?.length) throw new Error('No valid events found in file. Check date/time columns.');
      setPreviewEvents(data.data);
      setStep('preview');
      setConfirmed(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file');
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!bulkImportFile) return;
    // Same guard as handlePreview — belt-and-suspenders in case this ever
    // gets reached without going through preview first.
    if (workshopType === 'compulsory' && !selectedCourseId) {
      toast.error('Select a course first — compulsory workshops need a course to auto-register students.');
      return;
    }
    setBulkImporting(true);
    setShowConfirmDialog(false);
    try {
      const formData = new FormData();
      formData.append('file', bulkImportFile);
      formData.append('type', 'EVENTS');
      if (selectedCourseId) formData.append('courseId', selectedCourseId);
      if (workshopType === 'compulsory' && batchCode.trim()) formData.append('batchCode', batchCode.trim());
      if (workshopType) formData.append('workshopType', workshopType);
      if (workshopType === 'optional') formData.append('capacity', '60');

      const res = await fetch(`${API_BASE}/imports/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Import failed');

      // The backend returns HTTP success even when every row inside the file
      // failed to import (it only marks the job status/result as failed) —
      // check that explicitly instead of trusting `data.success`, otherwise a
      // fully-failed import silently shows a "success" toast with 0 events created.
      const jobResult = data.data?.result;
      const created = jobResult?.created ?? previewEvents.length;
      const failed = jobResult?.failed ?? 0;

      if (data.data?.status === 'FAILED' || (created === 0 && failed > 0)) {
        const firstError = jobResult?.errors?.[0]?.message;
        throw new Error(firstError ? `Import failed: ${firstError}` : 'Import failed — no events were created. Check your file format.');
      }

      const batchMsg = workshopType === 'compulsory'
        ? (batchCode.trim() ? ` · Batch ${batchCode.trim()} auto-registered` : ' · Students auto-registered per row\'s batch')
        : workshopType === 'optional' ? ' · Open for student registration (60 seats)' : '';
      if (failed > 0) {
        toast.error(`${failed} row(s) failed to import — ${jobResult?.errors?.[0]?.message || 'check your file'}`, { duration: 6000 });
      }
      toast.success(`${created} events imported successfully${batchMsg}!`, { duration: 5000 });
      setShowBulkImport(false);
      onImportComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showBulkImport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowBulkImport(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              style={{ background: 'rgb(var(--color-card))' }}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Upload className="w-5 h-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Bulk Import Events</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${step === 'select' ? 'bg-primary/20 text-primary' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {step !== 'select' ? '✓ ' : ''}1. Select Type
                      </span>
                      <span className="text-white/20 text-xs">→</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${step === 'form' ? 'bg-primary/20 text-primary' : step === 'preview' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                        {step === 'preview' ? '✓ ' : ''}2. Configure
                      </span>
                      <span className="text-white/20 text-xs">→</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${step === 'preview' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/30'}`}>
                        3. Preview & Confirm
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowBulkImport(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                {/* ─── STEP: SELECT TYPE ─── */}
                {step === 'select' && (
                  <div className="p-6 space-y-4">
                    <p className="text-xs text-white/40">Select the type of workshop to import</p>

                    {/* Compulsory Workshop */}
                    <button
                      onClick={() => { setWorkshopType('compulsory'); setStep('form'); }}
                      className="w-full flex items-start gap-4 p-5 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all text-left group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/30 transition-all">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">Compulsory Workshop</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Required</span>
                        </div>
                        <p className="text-xs text-white/50 mt-1 leading-relaxed">
                          Bulk import scheduled workshops for a compulsory course. All students of the selected batch will be auto-registered.
                        </p>
                      </div>
                      <div className="text-white/20 group-hover:text-primary transition-colors shrink-0 mt-1">→</div>
                    </button>

                    {/* Optional Workshop */}
                    <button
                      onClick={() => { setWorkshopType('optional'); setStep('form'); }}
                      className="w-full flex items-start gap-4 p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all text-left group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 group-hover:bg-amber-500/30 transition-all">
                        <Users className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">Optional Workshop</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">Open · 60 seats</span>
                        </div>
                        <p className="text-xs text-white/50 mt-1 leading-relaxed">
                          Published openly for students to self-register. Capacity is limited to 60 seats. Students who miss out get a notification.
                        </p>
                      </div>
                      <div className="text-white/20 group-hover:text-amber-400 transition-colors shrink-0 mt-1">→</div>
                    </button>
                  </div>
                )}

                {/* ─── STEP: FORM ─── */}
                {step === 'form' && (
                  <div className="p-6 space-y-5">
                    {/* Course selection */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Course</p>
                      <div>
                        <label className="text-xs font-medium text-white/60 mb-1.5 block">
                          Course Name
                          {workshopType === 'compulsory' && <span className="text-red-400"> *required</span>}
                        </label>
                        <div className="relative">
                          <select
                            value={selectedCourseId}
                            onChange={(e) => setSelectedCourseId(e.target.value)}
                            className="input-dark w-full px-4 py-2.5 rounded-xl text-sm appearance-none pr-10"
                          >
                            <option value="">— Select a course —</option>
                            {courses.map(c => (
                              <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                        </div>
                        <p className="text-[10px] text-white/30 mt-1">Workshop/session names are read directly from the &quot;workshop name&quot; column in your file — one row per session</p>
                      </div>
                    </div>

                    <div className="border-t border-white/5" />

                    {/* Batch + Count */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                        {workshopType === 'optional' ? 'Schedule' : 'Batch & Schedule'}
                      </p>

                      {workshopType === 'optional' && (
                        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <Users className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-300">Open Registration · 60 Seats</p>
                            <p className="text-[10px] text-amber-400/70 mt-0.5">Students will self-register. When seats are full, they receive a notification to try upcoming courses.</p>
                          </div>
                        </div>
                      )}

                      {workshopType === 'compulsory' && (
                        <div>
                          <label className="text-xs font-medium text-white/60 mb-1.5 block">
                            Batch Code <span className="text-white/30 font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={batchCode}
                            onChange={(e) => setBatchCode(e.target.value)}
                            placeholder="Leave blank to auto-detect from the file"
                            className="input-dark w-full px-4 py-2.5 rounded-xl text-sm font-mono"
                          />
                          <p className="text-[10px] text-white/30 mt-1 flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            {batchCode.trim()
                              ? `All rows use "${batchCode.trim()}" — students of this batch auto-registered`
                              : 'Auto-detected per row from the "tutorial/batch" column — one file can cover multiple batches'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/5" />

                    {/* Download template */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Schedule Template</p>
                      <p className="text-white/50 text-xs">
                        Download the template, fill in as many rows as you need (no limit), then upload below — the number of events created always matches your file.
                      </p>
                      <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                        <p className="text-[10px] text-white/30 mb-1 uppercase tracking-wider">Columns</p>
                        <p className="text-xs text-white/50 font-mono">{TEMPLATE_HEADERS.join(', ')}</p>
                        <p className="text-[10px] text-white/30 mt-2 uppercase tracking-wider">Format</p>
                        <p className="text-[10px] text-white/40 mt-0.5">date: DD-MM-YYYY &nbsp;·&nbsp; start time / end time: HH:MM AM/PM (e.g. 02:30 PM)</p>
                      </div>
                      <button
                        onClick={downloadTemplate}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all text-sm font-medium"
                      >
                        <Download className="w-4 h-4" /> Download Template
                      </button>
                    </div>

                    <div className="border-t border-white/5" />

                    {/* Upload */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Upload Filled Schedule</p>
                      <div
                        className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-primary/40 transition-all cursor-pointer"
                        onClick={() => document.getElementById('bulk-import-input')?.click()}
                      >
                        <FileSpreadsheet className="w-10 h-10 text-white/20 mx-auto mb-3" />
                        <p className="text-white/50 text-sm">
                          {bulkImportFile ? bulkImportFile.name : 'Click to select file (.csv or .xlsx)'}
                        </p>
                        {bulkImportFile && (
                          <p className="text-xs text-white/30 mt-1">{(bulkImportFile.size / 1024).toFixed(1)} KB</p>
                        )}
                        <input
                          id="bulk-import-input"
                          type="file"
                          accept=".csv,.xlsx"
                          className="hidden"
                          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP: PREVIEW ─── */}
                {step === 'preview' && (
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {previewEvents.length} Events Ready to Import
                        </p>
                        {workshopType === 'compulsory' && (
                          <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1.5">
                            <Users className="w-3 h-3" />
                            {batchCode.trim()
                              ? <>Batch <span className="font-mono font-bold">{batchCode.trim()}</span> students will be auto-registered</>
                              : 'Each event auto-registers students of its own row\'s batch'}
                          </p>
                        )}
                        {workshopType === 'optional' && (
                          <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1.5">
                            <Users className="w-3 h-3" />
                            Open registration · 60 seats per event
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setStep('form')}
                        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>

                    {(() => {
                      const unmatchedCount = previewEvents.filter(
                        (ev) => (ev.instructor && ev.instructorMatched === false) || (ev.associateInstructorName && ev.associateInstructorMatched === false)
                      ).length;
                      if (!unmatchedCount) return null;
                      return (
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-300">
                            {unmatchedCount} row{unmatchedCount !== 1 ? 's have' : ' has'} an instructor/associate instructor name that doesn&apos;t match any registered account (highlighted below). The event will still import, but won&apos;t be assigned to that person — check spelling or import anyway and assign manually from Events later.
                          </p>
                        </div>
                      );
                    })()}

                    {(() => {
                      const moduleMismatchCount = previewEvents.filter((ev) => ev.moduleMatched === false).length;
                      if (!moduleMismatchCount) return null;
                      return (
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-300">
                            {moduleMismatchCount} row{moduleMismatchCount !== 1 ? 's have' : ' has'} a workshop name that doesn&apos;t match any module in this course (highlighted below). Fix the name in your file and re-upload — these rows will fail to import as-is.
                          </p>
                        </div>
                      );
                    })()}

                    {/* Preview table */}
                    <div className="rounded-xl border border-white/8 overflow-hidden">
                      <div className="overflow-x-auto max-h-60 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0" style={{ background: 'rgb(var(--color-card))' }}>
                            <tr className="border-b border-white/5">
                              <th className="px-3 py-2 text-left text-white/40 font-semibold w-8">#</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Workshop</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Date</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Start Time</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">End Time</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Venue</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Instructor</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Associate Instructor</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Quiz Link</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Feedback Link</th>
                              <th className="px-3 py-2 text-left text-white/40 font-semibold">Batch</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {previewEvents.map((ev, i) => (
                              <tr key={i} className="hover:bg-white/[0.02]">
                                <td className="px-3 py-2 text-white/30">{i + 1}</td>
                                <td className="px-3 py-2 text-white font-medium max-w-[160px]">
                                  <p className={`truncate ${ev.moduleMatched === false ? 'text-red-400' : 'text-white'}`}>{ev.title}</p>
                                  {ev.moduleMatched === false && (
                                    <p className="text-[9px] text-red-400/80 mt-0.5">⚠ No matching module — will fail to import</p>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-white/60 whitespace-nowrap">{fmtDate(ev.startAt)}</td>
                                <td className="px-3 py-2 text-white/60 whitespace-nowrap">{fmtTime(ev.startAt)}</td>
                                <td className="px-3 py-2 text-white/60 whitespace-nowrap">{ev.endAt ? fmtTime(ev.endAt) : '—'}</td>
                                <td className="px-3 py-2 text-white/60 max-w-[120px]">
                                  <p className="truncate">{ev.venue || '—'}</p>
                                </td>
                                <td className="px-3 py-2 max-w-[140px]">
                                  <p className={`truncate ${ev.instructor && ev.instructorMatched === false ? 'text-amber-400' : 'text-white/60'}`}>
                                    {ev.instructor || '—'}
                                  </p>
                                  {ev.instructor && ev.instructorMatched === false && (
                                    <p className="text-[9px] text-amber-400/70 mt-0.5">⚠ No matching account — won&apos;t be assigned</p>
                                  )}
                                </td>
                                <td className="px-3 py-2 max-w-[140px]">
                                  <p className={`truncate ${ev.associateInstructorName && ev.associateInstructorMatched === false ? 'text-amber-400' : 'text-white/60'}`}>
                                    {ev.associateInstructorName || '—'}
                                  </p>
                                  {ev.associateInstructorName && ev.associateInstructorMatched === false && (
                                    <p className="text-[9px] text-amber-400/70 mt-0.5">⚠ No matching account — won&apos;t be assigned</p>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-white/60 max-w-[120px]">
                                  {ev.quizLink
                                    ? <a href={ev.quizLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block" onClick={(e) => e.stopPropagation()}>Link</a>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                <td className="px-3 py-2 text-white/60 max-w-[120px]">
                                  {ev.feedbackLink
                                    ? <a href={ev.feedbackLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block" onClick={(e) => e.stopPropagation()}>Link</a>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {ev.batch
                                    ? <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px]">{ev.batch}</span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Confirm This */}
                    {!confirmed ? (
                      <button
                        onClick={() => setConfirmed(true)}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirm This Schedule
                      </button>
                    ) : (
                      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <p className="text-sm text-emerald-400 font-medium">Schedule confirmed — ready to import</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-2 flex gap-3 shrink-0 border-t border-white/5">
                {step === 'select' ? (
                  <button
                    onClick={() => setShowBulkImport(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                ) : step === 'form' ? (
                  <>
                    <button
                      onClick={() => setStep('select')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      disabled={!bulkImportFile || previewing}
                      onClick={handlePreview}
                      className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {previewing
                        ? <><div className="w-4 h-4 border-2 border-[#ffffff] border-t-transparent rounded-full animate-spin" /> Parsing...</>
                        : <><Eye className="w-4 h-4" /> Preview Events</>}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setStep('form')}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      disabled={!confirmed || bulkImporting || hasModuleMismatch}
                      onClick={() => setShowConfirmDialog(true)}
                      title={hasModuleMismatch ? 'Fix the unmatched workshop name(s) above before importing' : undefined}
                      className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkImporting
                        ? <><div className="w-4 h-4 border-2 border-[#ffffff] border-t-transparent rounded-full animate-spin" /> Importing...</>
                        : <><Upload className="w-4 h-4" /> Import Events</>}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowConfirmDialog(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative rounded-2xl p-6 max-w-sm w-full border border-white/15 shadow-2xl"
              style={{ background: 'rgb(var(--color-card))' }}
            >
              <div className="flex items-start gap-3 mb-5">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Import {previewEvents.length} Events?</p>
                  <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
                    This will create <span className="text-white font-semibold">{previewEvents.length} events</span>
                    {workshopType === 'compulsory' && (
                      batchCode.trim()
                        ? <> and auto-register all students with batch code <span className="font-mono font-bold text-primary">{batchCode.trim()}</span></>
                        : <> and auto-register each event's students based on the batch in its own row</>
                    )}
                    {workshopType === 'optional' && (
                      <> as open workshops with <span className="text-white font-semibold">60 seats</span> each for student self-registration</>
                    )}.
                    Events will be published immediately.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Yes, Import
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
