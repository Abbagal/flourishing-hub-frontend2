'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileSpreadsheet, Users, CheckCircle, AlertCircle, Trash2, ChevronDown, Search, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface BatchUploadModalProps {
  show: boolean;
  onClose: () => void;
  courses: any[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface FileResult {
  fileName: string;
  status: 'pending' | 'uploading' | 'needs-resolution' | 'done' | 'error';
  matched?: number;
  stored?: number;
  skipped?: number;
  removed?: number;
  cancelledRegistrations?: number;
  errors?: any[];
  errorMessage?: string;
}

interface PendingResolution {
  fileIndex: number;
  courseName: string;
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  duplicates: { row: number; name: string | null; email: string | null; rollNumber: string | null; batchCode: string; reason?: string }[];
  overrideRemovalCount: number;
  overrideRemovalPreview: { name: string | null; email: string | null; rollNumber: string | null; batchCode: string }[];
}

export default function BatchUploadModal({ show, onClose, courses }: BatchUploadModalProps) {
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [allDone, setAllDone] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  const [pendingResolution, setPendingResolution] = useState<PendingResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [deleteMenuOpenId, setDeleteMenuOpenId] = useState<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (!show) {
      setFiles([]); setFileResults([]); setAllDone(false); setShowRecords(false);
      setRecords([]); setSelectedCourseId(''); setPendingResolution(null);
    }
  }, [show]);

  useEffect(() => {
    if (show && selectedCourseId) fetchStats();
    if (show && selectedCourseId) { setShowRecords(false); setRecords([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, selectedCourseId]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/batch-assignments/stats?courseId=${selectedCourseId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch {}
  };

  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await fetch(`${API_BASE}/batch-assignments/records?courseId=${selectedCourseId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setRecords(data.data || []);
    } catch {}
    finally { setLoadingRecords(false); }
  };

  // Upload only ever adds/updates records — there was never a way to remove
  // a student who's absent from a later re-upload, so they kept showing up
  // in the roster forever. 'current' removes just this one (module, batch)
  // row; 'all-batches' removes every row this student holds in THIS course.
  const handleDeleteRecord = async (record: any, scope: 'current' | 'all-batches') => {
    setDeleteMenuOpenId(null);
    setDeletingRecordId(record.id);
    try {
      const res = await fetch(`${API_BASE}/batch-assignments/records/${record.id}?scope=${scope}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Delete failed');
      toast.success(
        scope === 'all-batches'
          ? `Removed from ${data.data.deletedCount} batch(es) in this course${data.data.cancelledRegistrations ? ` — ${data.data.cancelledRegistrations} registration(s) cancelled` : ''}`
          : `Removed from ${record.batchCode}${data.data.cancelledRegistrations ? ' — registration cancelled' : ''}`
      );
      await fetchRecords();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove student');
    } finally {
      setDeletingRecordId(null);
    }
  };

  const toggleRecords = () => {
    const next = !showRecords;
    setShowRecords(next);
    if (next && records.length === 0) fetchRecords();
  };

  const filteredRecords = records.filter((r) => {
    if (!recordSearch) return true;
    const q = recordSearch.toLowerCase();
    return (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q) ||
      (r.rollNumber || '').toLowerCase().includes(q) || (r.batchCode || '').toLowerCase().includes(q);
  });

  const handleFilesChange = (selected: FileList | null) => {
    if (!selected) return;
    const newFiles = Array.from(selected);
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const unique = newFiles.filter(f => !existingNames.has(f.name));
      return [...prev, ...unique];
    });
    setFileResults([]);
    setAllDone(false);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFileResults([]);
    setAllDone(false);
  };

  const uploadOneFile = async (file: File, resolutionMode?: 'confirm' | 'skip-duplicates' | 'update-override') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', selectedCourseId);
    if (resolutionMode) formData.append('resolutionMode', resolutionMode);
    const res = await fetch(`${API_BASE}/batch-assignments/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Upload failed');
    return data.data;
  };

  // Uploads files starting at `fromIndex`, pausing (without advancing) the
  // moment a file comes back needing duplicate resolution — handleResolution
  // picks the loop back up from the same index once the admin chooses.
  const runUploadQueue = async (fromIndex: number, results: FileResult[]) => {
    let totalMatched = 0, totalStored = 0;

    for (let i = fromIndex; i < files.length; i++) {
      results[i].status = 'uploading';
      setFileResults([...results]);

      try {
        const data = await uploadOneFile(files[i]);

        if (data.requiresResolution) {
          results[i] = { fileName: files[i].name, status: 'needs-resolution' };
          setFileResults([...results]);
          setPendingResolution({
            fileIndex: i,
            courseName: data.courseName,
            totalRows: data.totalRows,
            newCount: data.newCount,
            duplicateCount: data.duplicateCount,
            duplicates: data.duplicates,
            overrideRemovalCount: data.overrideRemovalCount || 0,
            overrideRemovalPreview: data.overrideRemovalPreview || [],
          });
          setUploading(false);
          return; // paused — handleResolution resumes from here
        }

        results[i] = {
          fileName: files[i].name,
          status: 'done',
          matched: data.matched,
          stored: data.stored,
          skipped: data.skipped,
          errors: data.errors
        };
        totalMatched += data.matched || 0;
        totalStored += data.stored || 0;
      } catch (err: any) {
        results[i] = { fileName: files[i].name, status: 'error', errorMessage: err.message };
      }

      setFileResults([...results]);
    }

    setUploading(false);
    setAllDone(true);
    fetchStats();

    const errorCount = results.filter(r => r.status === 'error').length;
    if (errorCount > 0 && !totalMatched && !totalStored) {
      toast.error(`Upload failed for ${errorCount} file(s)`, { duration: 6000 });
    } else if (errorCount > 0) {
      toast(`Processed ${files.length} file(s) — ${totalMatched} matched, ${totalStored} stored, ${errorCount} failed`, { icon: '⚠️', duration: 6000 });
    } else {
      toast.success(`${files.length} file(s) processed — ${totalMatched} matched, ${totalStored} stored`, { duration: 5000 });
    }
  };

  const handleUploadAll = async () => {
    if (!files.length) return;
    if (!selectedCourseId) { toast.error('Select a course first'); return; }
    setUploading(true);
    setAllDone(false);
    const results: FileResult[] = files.map(f => ({ fileName: f.name, status: 'pending' }));
    setFileResults(results);
    runUploadQueue(0, results);
  };

  const handleResolution = async (mode: 'confirm' | 'skip-duplicates' | 'update-override') => {
    if (!pendingResolution) return;
    const { fileIndex } = pendingResolution;
    setResolving(true);
    const results = [...fileResults];

    try {
      const data = await uploadOneFile(files[fileIndex], mode);
      results[fileIndex] = {
        fileName: files[fileIndex].name,
        status: 'done',
        matched: data.matched,
        stored: data.stored,
        skipped: data.skipped,
        removed: data.removed,
        cancelledRegistrations: data.cancelledRegistrations,
        errors: data.errors
      };
      if (mode === 'update-override' && data.removed > 0) {
        toast.success(`${data.removed} student(s) removed — they were missing from this file`, { duration: 6000 });
      }
    } catch (err: any) {
      results[fileIndex] = { fileName: files[fileIndex].name, status: 'error', errorMessage: err.message };
    }

    setFileResults(results);
    setPendingResolution(null);
    setResolving(false);
    setUploading(true);
    runUploadQueue(fileIndex + 1, results);
  };

  const totalMatched = fileResults.reduce((s, r) => s + (r.matched || 0), 0);
  const totalStored = fileResults.reduce((s, r) => s + (r.stored || 0), 0);
  const doneCount = fileResults.filter(r => r.status === 'done' || r.status === 'error').length;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && !uploading && !pendingResolution && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            style={{ background: 'rgb(var(--color-card))' }}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Upload Student Batch Data</h2>
                  <p className="text-xs text-white/40 mt-0.5">Course-wise — upload multiple files at once</p>
                </div>
              </div>
              {!uploading && !pendingResolution && (
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Course selection — required, drives everything else */}
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Course <span className="text-amber-400">*</span></label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  disabled={uploading || files.length > 0}
                  className="filter-select w-full px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white disabled:opacity-50"
                >
                  <option value="">— Select a course —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code ? `${c.code} · ${c.name}` : c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-white/30 mt-1">Course name comes from Course Management — students are uploaded against this specific course.</p>
              </div>

              {!selectedCourseId && (
                <div className="text-center py-6 text-white/30 text-sm">Select a course above to continue</div>
              )}

              {selectedCourseId && (
              <>
              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                    <p className="text-xl font-bold text-white">{stats.total}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">Total Records</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                    <p className="text-xl font-bold text-emerald-400">{stats.matched}</p>
                    <p className="text-[10px] text-emerald-400/60 mt-0.5">Matched</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                    <p className="text-xl font-bold text-amber-400">{stats.pending}</p>
                    <p className="text-[10px] text-amber-400/60 mt-0.5">Pending Signup</p>
                  </div>
                </div>
              )}

              {/* Batch breakdown */}
              {stats?.byBatch?.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">By Batch (this course)</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.byBatch.map((b: any) => (
                      <span key={b.batchCode} className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-mono">
                        {b.batchCode} · {b.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* View uploaded records */}
              {stats?.total > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5">
                  <button
                    onClick={toggleRecords}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-white/70 hover:text-white transition-colors"
                  >
                    <span>View Records for This Course ({stats.total})</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showRecords ? 'rotate-180' : ''}`} />
                  </button>
                  {showRecords && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                        <input
                          value={recordSearch}
                          onChange={(e) => setRecordSearch(e.target.value)}
                          placeholder="Search by name, email, roll no, batch..."
                          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      {loadingRecords ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-white/5">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-card">
                              <tr className="border-b border-white/5">
                                <th className="px-3 py-2 text-left text-white/40 font-semibold">Name</th>
                                <th className="px-3 py-2 text-left text-white/40 font-semibold">Roll No</th>
                                <th className="px-3 py-2 text-left text-white/40 font-semibold">Email</th>
                                <th className="px-3 py-2 text-left text-white/40 font-semibold">Batch</th>
                                <th className="px-3 py-2 text-left text-white/40 font-semibold">Department</th>
                                <th className="px-3 py-2 text-left text-white/40 font-semibold">Signup Status</th>
                                <th className="px-3 py-2 text-right text-white/40 font-semibold"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRecords.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-6 text-white/30">No records found</td></tr>
                              ) : filteredRecords.map((r: any) => (
                                <tr key={r.id} className="border-b border-white/[0.03]">
                                  <td className="px-3 py-2 text-white">{r.name || '—'}</td>
                                  <td className="px-3 py-2 text-white/60 font-mono">{r.rollNumber || '—'}</td>
                                  <td className="px-3 py-2 text-white/60">{r.email || '—'}</td>
                                  <td className="px-3 py-2 text-white/60 font-mono">{r.batchCode}</td>
                                  <td className="px-3 py-2 text-white/60">{r.department || '—'}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.isMatched ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                      {r.isMatched ? 'Signed Up' : 'Not Signed Up Yet'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right relative">
                                    {deletingRecordId === r.id ? (
                                      <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin ml-auto" />
                                    ) : (
                                      <button
                                        onClick={() => setDeleteMenuOpenId(deleteMenuOpenId === r.id ? null : r.id)}
                                        className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-all"
                                        title="Remove student"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {deleteMenuOpenId === r.id && (
                                      <>
                                        <div className="fixed inset-0 z-10" onClick={() => setDeleteMenuOpenId(null)} />
                                        <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-white/10 bg-card shadow-xl py-1 text-left">
                                          <button
                                            onClick={() => handleDeleteRecord(r, 'current')}
                                            className="w-full px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors text-left"
                                          >
                                            Delete from current batch
                                            <span className="block text-[10px] text-white/30 mt-0.5">Only {r.batchCode} ({r.courseModule?.title || 'this module'})</span>
                                          </button>
                                          <button
                                            onClick={() => handleDeleteRecord(r, 'all-batches')}
                                            className="w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left"
                                          >
                                            Delete from all batches
                                            <span className="block text-[10px] text-red-400/50 mt-0.5">Every batch/module for this student in this course</span>
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Column hint */}
              <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-xs font-semibold text-white mb-1">Supported columns</p>
                <p className="text-[10px] text-white/40 font-mono">email · roll_no · batch_code · name · department · programme · year · section · module</p>
                <p className="text-[10px] text-white/30 mt-1.5">Required: <span className="text-white/50">batch_code</span> + at least one of <span className="text-white/50">email</span> or <span className="text-white/50">roll_no</span></p>
                <p className="text-[10px] text-white/30 mt-1">
                  <span className="text-white/50">module</span> is optional — only needed if the same student has a
                  different batch per module of this course (e.g. Module A batch M1B1, Module B batch M2B3). Leave it
                  blank for the usual one-batch-for-the-whole-course case.
                </p>
              </div>

              {/* Duplicate resolution panel */}
              {pendingResolution && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-300">
                        {pendingResolution.duplicateCount} duplicate student{pendingResolution.duplicateCount !== 1 ? 's' : ''} found in {pendingResolution.courseName}
                      </p>
                      <p className="text-xs text-amber-400/70 mt-0.5">
                        {pendingResolution.newCount} new · {pendingResolution.duplicateCount} already uploaded for this course or repeated within this file — see &quot;Why&quot; below
                      </p>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto overflow-x-auto rounded-lg border border-white/5">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-white/5">
                          <th className="px-3 py-2 text-left text-white/40 font-semibold">Row</th>
                          <th className="px-3 py-2 text-left text-white/40 font-semibold">Name</th>
                          <th className="px-3 py-2 text-left text-white/40 font-semibold">Email / Roll No</th>
                          <th className="px-3 py-2 text-left text-white/40 font-semibold">Batch</th>
                          <th className="px-3 py-2 text-left text-white/40 font-semibold">Why</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingResolution.duplicates.map((d) => (
                          <tr key={d.row} className="border-b border-white/[0.03]">
                            <td className="px-3 py-2 text-white/40">{d.row}</td>
                            <td className="px-3 py-2 text-white">{d.name || '—'}</td>
                            <td className="px-3 py-2 text-white/60 font-mono">{d.email || d.rollNumber || '—'}</td>
                            <td className="px-3 py-2 text-white/60 font-mono">{d.batchCode}</td>
                            <td className="px-3 py-2 text-white/50">{d.reason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pendingResolution.overrideRemovalCount > 0 && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3">
                      <p className="text-xs font-semibold text-red-300">
                        {pendingResolution.overrideRemovalCount} previously-uploaded student{pendingResolution.overrideRemovalCount !== 1 ? 's are' : ' is'} missing from this file
                      </p>
                      <p className="text-[10px] text-red-400/60 mt-1">
                        {pendingResolution.overrideRemovalPreview.map((r) => r.name || r.email || r.rollNumber).filter(Boolean).join(', ')}
                        {pendingResolution.overrideRemovalCount > pendingResolution.overrideRemovalPreview.length ? ', ...' : ''}
                      </p>
                      <p className="text-[10px] text-red-400/40 mt-1">Only "Update &amp; Override" below removes them — the other two options leave them untouched.</p>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex gap-2">
                      <button
                        disabled={resolving}
                        onClick={() => handleResolution('skip-duplicates')}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                      >
                        Remove Duplicates &amp; Upload {pendingResolution.newCount} New
                      </button>
                      <button
                        disabled={resolving}
                        onClick={() => handleResolution('confirm')}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all disabled:opacity-50"
                      >
                        {resolving ? 'Uploading...' : `Confirm Upload All ${pendingResolution.totalRows}`}
                      </button>
                    </div>
                    <button
                      disabled={resolving}
                      onClick={() => handleResolution('update-override')}
                      className="w-full py-2 rounded-lg text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 transition-all disabled:opacity-50"
                    >
                      {resolving
                        ? 'Uploading...'
                        : `Update & Override — Upload ${pendingResolution.totalRows}${pendingResolution.overrideRemovalCount > 0 ? ` & Remove ${pendingResolution.overrideRemovalCount} Missing` : ''}`}
                    </button>
                    <p className="text-[10px] text-white/30 text-center">
                      This file becomes the full roster for every batch it touches — anyone previously uploaded to that same batch but missing here gets removed.
                    </p>
                  </div>
                </div>
              )}

              {/* File drop zone */}
              <div>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    uploading || !!pendingResolution ? 'border-white/5 opacity-50 cursor-not-allowed' : 'border-white/10 hover:border-primary/40 cursor-pointer'
                  }`}
                  onClick={() => !uploading && !pendingResolution && document.getElementById('batch-multi-input')?.click()}
                >
                  <FileSpreadsheet className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-white/50 text-sm font-medium">Click to select files</p>
                  <p className="text-white/30 text-xs mt-1">Multiple .csv or .xlsx files — select all at once</p>
                  <input
                    id="batch-multi-input"
                    type="file"
                    accept=".csv,.xlsx"
                    multiple
                    disabled={uploading || !!pendingResolution}
                    className="hidden"
                    onChange={(e) => handleFilesChange(e.target.files)}
                  />
                </div>
              </div>

              {/* Selected files list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{files.length} Files Selected</p>
                    {!uploading && allDone && (
                      <p className="text-xs text-emerald-400">{doneCount}/{files.length} processed</p>
                    )}
                    {uploading && (
                      <p className="text-xs text-primary">{doneCount}/{files.length} done...</p>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {files.map((f, i) => {
                      const result = fileResults[i];
                      return (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                          <FileSpreadsheet className="w-4 h-4 text-white/30 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{f.name}</p>
                            {result?.status === 'done' && (
                              <p className="text-[10px] text-emerald-400 mt-0.5">
                                ✅ {result.matched} matched · {result.stored} stored
                                {(result.skipped || 0) > 0 && <span className="text-red-400"> · {result.skipped} skipped</span>}
                                {(result.removed || 0) > 0 && <span className="text-red-400"> · {result.removed} removed</span>}
                              </p>
                            )}
                            {result?.status === 'error' && (
                              <p className="text-[10px] text-red-400 mt-0.5">❌ {result.errorMessage}</p>
                            )}
                            {result?.status === 'uploading' && (
                              <p className="text-[10px] text-primary mt-0.5">Uploading...</p>
                            )}
                            {result?.status === 'needs-resolution' && (
                              <p className="text-[10px] text-amber-400 mt-0.5">⚠️ Duplicates found — resolve above</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {result?.status === 'done' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            {result?.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                            {(result?.status === 'uploading') && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                            {result?.status === 'needs-resolution' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                            {!uploading && !result && (
                              <button onClick={() => removeFile(i)} className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary after all done */}
                  {allDone && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                        <p className="text-lg font-bold text-emerald-400">{totalMatched}</p>
                        <p className="text-[10px] text-emerald-400/60">Total Matched</p>
                      </div>
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                        <p className="text-lg font-bold text-amber-400">{totalStored}</p>
                        <p className="text-[10px] text-amber-400/60">Total Stored</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 flex gap-3 shrink-0 border-t border-white/5">
              <button
                onClick={onClose}
                disabled={uploading || !!pendingResolution}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-40"
              >
                {allDone ? 'Close' : 'Cancel'}
              </button>
              <button
                disabled={!files.length || uploading || !selectedCourseId || !!pendingResolution || allDone}
                onClick={handleUploadAll}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading
                  ? <><div className="w-4 h-4 border-2 border-[#ffffff] border-t-transparent rounded-full animate-spin" /> Processing {doneCount + 1}/{files.length}...</>
                  : allDone
                  ? <><CheckCircle className="w-4 h-4" /> Upload Complete</>
                  : <><Upload className="w-4 h-4" /> Upload {files.length > 0 ? `${files.length} Files` : 'Files'}</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
