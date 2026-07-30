'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, CheckCircle, Clock, MapPin, Calendar, ShieldCheck, ShieldX,
  FileText, BookOpen, GraduationCap, RefreshCw, Star, ChevronDown, UserX
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiCall } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

function StatTile({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/25 text-blue-300',
    amber: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    purple: 'bg-violet-500/10 border-violet-500/25 text-violet-300',
    teal: 'bg-teal-500/10 border-teal-500/25 text-teal-300',
    red: 'bg-red-500/10 border-red-500/25 text-red-300',
  };
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-[11px] sm:text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function CollapsibleCard({ title, icon: Icon, open, onToggle, children }: { title: string; icon: any; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/10 mb-4 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 text-left">
        <span className="flex items-center gap-2 text-sm sm:text-base font-semibold text-white">
          <Icon className="w-4 h-4 text-primary shrink-0" /> {title}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 sm:px-5 pb-4 sm:pb-5">{children}</div>}
    </div>
  );
}

export default function InstructorEventLivePage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [quiz, setQuiz] = useState<any>(null);
  const [feedbackForm, setFeedbackForm] = useState<any>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvent = async () => {
    try {
      const res = await apiCall('/event-operations/my-assigned-events');
      const found = (res.data || []).find((e: any) => e.id === eventId);
      setEvent(found || null);
    } catch {
      toast.error('Failed to load event');
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await apiCall(`/event-operations/${eventId}/live-summary`);
      setSummary(res.data);
    } catch {
      // silent — polled
    }
  };

  const fetchCheckIns = async () => {
    try {
      const res = await apiCall(`/event-operations/${eventId}/check-ins`);
      setCheckIns(res.data || []);
    } catch {
      // silent — polled
    }
  };

  const fetchQuiz = async () => {
    try {
      const res = await apiCall(`/event-operations/${eventId}/staff-quiz`);
      setQuiz(res.data);
    } catch {
      // silent
    }
  };

  const fetchFeedbackForm = async () => {
    try {
      const res = await apiCall(`/event-operations/${eventId}/staff-feedback-form`);
      setFeedbackForm(res.data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchEvent(), fetchSummary(), fetchCheckIns(), fetchQuiz(), fetchFeedbackForm()]);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Live view — keep counts and the check-in list fresh without a manual refresh.
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchSummary();
      fetchCheckIns();
    }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const handleVerify = async (checkInId: string, status: 'VERIFIED' | 'REJECTED', note = '') => {
    setVerifyingId(checkInId);
    try {
      await apiCall(`/event-operations/check-ins/${checkInId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      });
      toast.success(status === 'VERIFIED' ? 'Attendance verified' : 'Marked absent');
      await Promise.all([fetchCheckIns(), fetchSummary()]);
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerifyAll = async () => {
    try {
      await apiCall(`/event-operations/${eventId}/check-ins/verify-all`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('All pending check-ins verified');
      await Promise.all([fetchCheckIns(), fetchSummary()]);
    } catch {
      toast.error('Failed to verify all');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!event) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <p className="text-white/40 mb-3">Event not found, or you're not assigned to it.</p>
          <button onClick={() => router.push('/instructor')} className="text-primary text-sm hover:underline">Back to dashboard</button>
        </div>
      </DashboardLayout>
    );
  }

  const pendingCount = checkIns.filter((c) => c.status === 'PENDING').length;
  const instructorName = event.assignments?.find((a: any) => a.role === 'INSTRUCTOR')?.user?.name;
  const associateInstructorName = event.assignments?.find((a: any) => a.role === 'ASSOCIATE_INSTRUCTOR')?.user?.name;
  const volunteerNames = (event.assignments || []).filter((a: any) => a.role === 'VOLUNTEER').map((a: any) => a.user?.name).filter(Boolean);

  return (
    <DashboardLayout>
      <button onClick={() => router.push('/instructor')} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-tight break-words">{event.title}</h1>

        {event.course?.name && (
          <p className="flex items-center gap-1.5 text-sm sm:text-base font-semibold text-violet-300 mt-1.5">
            <BookOpen className="w-4 h-4 shrink-0" /> {event.course.name}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs sm:text-sm text-white/50">
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 shrink-0" /> {formatDate(event.startAt)}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 shrink-0" /> {formatTime(event.startAt)}</span>
          {event.venue && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" /> {event.venue}</span>}
          {event.batch && <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5 shrink-0" /> Batch {event.batch}</span>}
        </div>

        {(instructorName || associateInstructorName || volunteerNames.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs sm:text-sm text-white/40">
            {instructorName && <span>Instructor: <span className="text-white/70 font-medium">{instructorName}</span></span>}
            {associateInstructorName && <span>Associate: <span className="text-white/70 font-medium">{associateInstructorName}</span></span>}
            {volunteerNames.length > 0 && <span>Volunteer{volunteerNames.length > 1 ? 's' : ''}: <span className="text-white/70 font-medium">{volunteerNames.join(', ')}</span></span>}
          </div>
        )}
      </motion.div>

      {/* Live analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-6">
        <StatTile label="Registered" value={summary?.registeredCount ?? '—'} icon={Users} color="blue" />
        <StatTile label="Checked In" value={summary?.checkedInCount ?? '—'} icon={CheckCircle} color="amber" />
        <StatTile label="Present (Verified)" value={summary?.presentCount ?? '—'} icon={ShieldCheck} color="emerald" />
        {summary?.hasQuiz && <StatTile label="Quiz Submitted" value={summary?.quizSubmittedCount ?? '—'} icon={FileText} color="purple" />}
        <StatTile label="Feedback Given" value={summary?.feedbackSubmittedCount ?? '—'} icon={Star} color="teal" />
      </div>

      {/* Quiz preview */}
      {summary?.hasQuiz && quiz?.available && (
        <CollapsibleCard title={quiz.title ? `Session Quiz — ${quiz.title}` : 'Session Quiz'} icon={FileText} open={showQuiz} onToggle={() => setShowQuiz((v) => !v)}>
          <div className="space-y-2.5">
            {(quiz.questions || []).map((q: any, i: number) => (
              <div key={q.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-white font-medium mb-2">{i + 1}. {q.questionText}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {OPTION_KEYS.map((k) => (
                    <div key={k} className={`px-2.5 py-1.5 rounded-lg border ${q.correctOption === k ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium' : 'bg-white/5 border-white/10 text-white/60'}`}>
                      {k}. {q[`option${k}`]} {q.correctOption === k && '✓'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* Feedback form preview */}
      {summary?.hasFeedbackForm && feedbackForm?.available && (
        <CollapsibleCard title={feedbackForm.title ? `Feedback Form — ${feedbackForm.title}` : 'Feedback Form'} icon={Star} open={showFeedback} onToggle={() => setShowFeedback((v) => !v)}>
          <div className="space-y-2.5">
            {(feedbackForm.questions || []).map((q: any, i: number) => (
              <div key={q.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-white font-medium">{i + 1}. {q.questionText} <span className="text-white/30 text-xs font-normal">({q.type})</span></p>
                {q.type === 'MCQ' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs mt-2">
                    {OPTION_KEYS.map((k) => (
                      <div key={k} className="px-2.5 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white/60">{k}. {q[`option${k}`]}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* Attendance list */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 shrink-0" /> Student Attendance
            <span className="text-[10px] text-white/30 font-normal">· auto-refreshes every 15s</span>
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchCheckIns(); fetchSummary(); }} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            {pendingCount > 0 && (
              <button onClick={handleVerifyAll} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 text-xs font-semibold transition-all whitespace-nowrap">
                Verify All Pending ({pendingCount})
              </button>
            )}
          </div>
        </div>

        {checkIns.length === 0 ? (
          <div className="text-center py-10">
            <UserX className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No students have checked in yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {checkIns.map((ci) => {
              const isActing = verifyingId === ci.id;
              return (
                <div key={ci.id} className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{ci.user?.name || '—'}</p>
                    <p className="text-xs text-white/40">
                      {ci.user?.studentProfile?.rollNumber || '—'} · {ci.user?.studentProfile?.cohort || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      ci.status === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-400' :
                      ci.status === 'REJECTED' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>{ci.status}</span>
                    {ci.status === 'PENDING' && (
                      <>
                        <button
                          disabled={isActing}
                          onClick={() => handleVerify(ci.id, 'VERIFIED')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all text-xs font-medium disabled:opacity-50"
                        >
                          {isActing ? <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                          Verify
                        </button>
                        <button
                          disabled={isActing}
                          onClick={() => handleVerify(ci.id, 'REJECTED', 'Absent')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all text-xs font-medium disabled:opacity-50"
                        >
                          <ShieldX className="w-3 h-3" /> Mark Absent
                        </button>
                      </>
                    )}
                    {ci.status === 'VERIFIED' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleVerify(ci.id, 'REJECTED', 'Unverified by instructor')}
                        className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-all text-xs font-medium disabled:opacity-50"
                      >
                        Unverify
                      </button>
                    )}
                    {ci.status === 'REJECTED' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleVerify(ci.id, 'VERIFIED')}
                        className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-all text-xs font-medium disabled:opacity-50"
                      >
                        Re-verify
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
