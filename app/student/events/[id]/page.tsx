'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calendar, Clock, MapPin, Users, ExternalLink,
  Share2, Heart, CheckCircle, AlertCircle, Radio, Loader2,
  BookOpen, GraduationCap, Fingerprint, ShieldCheck, Zap,
  Wifi, Star, Award, Lock, Video, FileText, Flag
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiCall } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { isEventLive, isEventLiveOrGrace, isGracePeriodActive, getGraceSecondsRemaining, isEventUpcoming, isRegistrationOpen, isPastEventMidpoint } from '@/lib/dateUtils';
import { getRegisteredEventIds } from '@/lib/registrationUtils';
import type { AuthPayload, QuizStudentView, QuizOptionKey, FeedbackFormStudentView, FeedbackStudentAnswer } from '@/types';
import toast from 'react-hot-toast';

const QUIZ_OPTION_KEYS: QuizOptionKey[] = ['A', 'B', 'C', 'D'];
const QUIZ_OPTION_FIELD: Record<QuizOptionKey, 'optionA' | 'optionB' | 'optionC' | 'optionD'> = {
  A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD',
};
const FEEDBACK_MCQ_KEYS = ['A', 'B', 'C', 'D'] as const;
const FEEDBACK_MCQ_FIELD: Record<typeof FEEDBACK_MCQ_KEYS[number], 'optionA' | 'optionB' | 'optionC' | 'optionD'> = {
  A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD',
};

export default function EventDetailPage() {
  const [user, setUser] = useState<AuthPayload | null>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkIn, setCheckIn] = useState<any>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const [myAttendanceRec, setMyAttendanceRec] = useState<any>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ totalMarks: number | null; totalMax: number | null; scores: any[] } | null>(null);
  const [myQuiz, setMyQuiz] = useState<QuizStudentView | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, QuizOptionKey>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [myFeedbackForm, setMyFeedbackForm] = useState<FeedbackFormStudentView | null>(null);
  const [feedbackFormAnswers, setFeedbackFormAnswers] = useState<Record<string, FeedbackStudentAnswer>>({});
  const [submittingFeedbackForm, setSubmittingFeedbackForm] = useState(false);
  const [graceSecsLeft, setGraceSecsLeft] = useState(0);
  const [showExitChecklist, setShowExitChecklist] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scorePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // null = not yet known (avoids a false "session ended" toast firing on
  // first mount for an event that's already over when the page loads).
  const wasLiveRef = useRef<boolean | null>(null);
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const fetchCheckInStatus = async () => {
    try {
      const res = await apiCall('/event-operations/' + eventId + '/my-check-in');
      setCheckIn(res.data || null);
    } catch {
      // silent
    }
  };

  const fetchMyProgress = async () => {
    try {
      const res = await apiCall('/event-operations/' + eventId + '/my-progress');
      if (res.data) setQuizScore(res.data);
    } catch {
      // silent
    }
  };

  // Server is the source of truth for whether the in-built quiz is unlocked
  // — it checks AttendanceRecord.status === 'PRESENT' itself, so this never
  // has to (and shouldn't) be re-derived from time windows on the client.
  const fetchMyQuiz = async () => {
    try {
      const res = await apiCall('/event-operations/' + eventId + '/quiz');
      setMyQuiz(res.data || null);
    } catch {
      // silent
    }
  };

  // Same server-authoritative unlock pattern as fetchMyQuiz above, for the
  // in-built Feedback library form. Quiz and feedback form are independent —
  // an event can have neither, either, or both applicable at once.
  const fetchMyFeedbackForm = async () => {
    try {
      const res = await apiCall('/event-operations/' + eventId + '/feedback-form');
      setMyFeedbackForm(res.data || null);
    } catch {
      // silent
    }
  };

  // Poll every 2s while PENDING so page transitions immediately when instructor verifies
  useEffect(() => {
    if (checkIn?.status === 'PENDING') {
      pollRef.current = setInterval(() => fetchCheckInStatus(), 5000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn?.status]);

  // Poll quiz score every 15s once verified; fetch the in-built quiz's
  // unlock/question state once at the same time (re-fetched again right
  // after a successful submission, no need to poll it separately).
  useEffect(() => {
    if (checkIn?.status === 'VERIFIED') {
      fetchMyProgress();
      fetchMyQuiz();
      fetchMyFeedbackForm();
      scorePollerRef.current = setInterval(() => fetchMyProgress(), 15000);
    } else {
      if (scorePollerRef.current) clearInterval(scorePollerRef.current);
    }
    return () => { if (scorePollerRef.current) clearInterval(scorePollerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn?.status]);

  // Grace period countdown timer
  useEffect(() => {
    if (!event?.endAt) return;
    const tick = () => setGraceSecsLeft(getGraceSecondsRemaining(event.endAt));
    tick();
    graceTimerRef.current = setInterval(tick, 1000);
    return () => { if (graceTimerRef.current) clearInterval(graceTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.endAt]);

  // Detect the exact moment the live session ends while this page is open —
  // piggybacks on the 1s grace-timer tick above rather than a second
  // interval. Previously the page just silently swapped from the live view
  // to the standard view with no notification at all.
  useEffect(() => {
    if (!event?.startAt && !event?.date) return;
    const nowIsLive = isEventLive(event.startAt || (event.date + 'T' + event.time), event.endAt);
    if (wasLiveRef.current === true && nowIsLive === false) {
      toast('Session has ended.', { icon: '🔔', duration: 6000 });
      setShowExitChecklist(true);
    }
    wasLiveRef.current = nowIsLive;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceSecsLeft, event?.startAt, event?.endAt, event?.date, event?.time]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    const fetchData = async () => {
      try {
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
          const userData = JSON.parse(cachedUser);
          setUser(userData);
        }

        const [eventsResponse, registrationsResponse, attendanceResponse, myFeedbackResponse] = await Promise.all([
          // activeOnly=false — this list is only used to look up THIS one
          // event by id below; the default (active-only) filter excludes
          // anything whose endAt has passed, so revisiting/refreshing a
          // completed event's own detail page wrongly hit "Event not found"
          // instead of showing it with a completed status.
          apiCall('/events?limit=200&activeOnly=false'),
          apiCall('/registrations/me'),
          apiCall('/event-operations/attendance/me').catch(() => ({ data: [] })),
          apiCall('/event-operations/' + eventId + '/my-feedback').catch(() => ({ data: null })),
        ]);

        const eventData = eventsResponse.data.items.find((e: any) => e.id === eventId);
        if (!eventData) {
          toast.error('Event not found');
          router.push('/student/events');
          return;
        }

        const startDate = new Date(eventData.startAt);
        const rawQuizLink = eventData.quizLink || eventData.courseModule?.quizLink || eventData.modules?.[0]?.quizLink || null;
        const rawFeedbackLink = eventData.feedbackLink || eventData.courseModule?.feedbackLink || eventData.modules?.[0]?.feedbackLink || null;
        const ensureHttps = (url: string | null) => {
          if (!url) return null;
          return url.startsWith('http') ? url : `https://${url}`;
        };

        const transformedEvent = {
          id: eventData.id,
          title: eventData.title || 'Untitled Event',
          description: eventData.description || '',
          startAt: eventData.startAt,
          endAt: eventData.endAt || null,
          date: startDate.toISOString().split('T')[0],
          time: startDate.toTimeString().slice(0, 5),
          venue: eventData.venue || 'TBD',
          mode: eventData.meetLink ? 'Online' : 'In Classroom',
          capacity: eventData.capacity || 0,
          registeredCount: eventData._count?.registrations || 0,
          status: eventData.status?.toLowerCase() || 'draft',
          organizer: eventData.createdBy?.name || 'Admin',
          meetLink: eventData.meetLink,
          quizLink: ensureHttps(rawQuizLink),
          feedbackLink: ensureHttps(rawFeedbackLink),
          courseName: eventData.course?.name || null,
          moduleName: eventData.courseModule?.title || null,
          batch: eventData.batch || null,
          instructorName: eventData.assignments?.find((a: any) => a.role === 'INSTRUCTOR')?.user?.name || null,
          associateInstructorName: eventData.assignments?.find((a: any) => a.role === 'ASSOCIATE_INSTRUCTOR')?.user?.name || null,
          volunteerNames: (eventData.assignments || []).filter((a: any) => a.role === 'VOLUNTEER').map((a: any) => a.user?.name).filter(Boolean),
        };

        setEvent(transformedEvent);
        // Page loaded mid-grace-window (student refreshed/re-opened after
        // the session ended rather than watching it end live) — show the
        // exit checklist right away instead of only on the live→ended
        // transition, which won't fire since it's already ended.
        if (isGracePeriodActive(transformedEvent.endAt)) {
          setShowExitChecklist(true);
        }

        const userRegistrations = registrationsResponse.data || [];
        const registered = userRegistrations.some((reg: any) =>
          reg.eventId === eventId && (reg.status === 'REGISTERED' || reg.status === 'ATTENDED')
        );
        setIsRegistered(registered);

        // Must match the grace-inclusive check used to decide whether the
        // check-in UI renders below (isLiveOrGrace) — using the stricter
        // isEventLive here left `checkIn` stuck at its initial null on any
        // mount/remount during the 45-min grace window (e.g. back then back
        // in), so an already-PENDING check-in rendered as "not checked in"
        // and re-submitting hit "You have already checked in".
        if (isEventLiveOrGrace(eventData.startAt, eventData.endAt)) {
          await fetchCheckInStatus();
          // Previously only fetched once VERIFIED, so the quiz/feedback
          // cards stayed completely invisible before check-in and while
          // verification was pending — the student had no way to see "this
          // unlocks once you're verified" until it already had. The
          // endpoints themselves are safe to call pre-verification (they
          // just return locked: true), so fetch them here too.
          fetchMyQuiz();
          fetchMyFeedbackForm();
        }

        const allAttendance: any[] = attendanceResponse.data || [];
        const thisEventRec = allAttendance.find((a: any) => a.eventId === eventId);
        setMyAttendanceRec(thisEventRec || null);
        if (thisEventRec?.starRating) {
          setFeedbackRating(thisEventRec.starRating);
          setFeedbackSubmitted(true);
        }
        // Authoritative "did I already rate this" check — the Feedback
        // table, not the attendance record above, is what submitting a
        // rating actually writes to. Without this, reloading the page
        // after rating would forget it happened and re-block Exit.
        if (myFeedbackResponse?.data?.eventRating) {
          setFeedbackRating(myFeedbackResponse.data.eventRating);
          setFeedbackSubmitted(true);
        }
      } catch (error) {
        console.error('Failed to fetch event details:', error);
        toast.error('Failed to load event details');
        router.push('/student/events');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, router]);

  const handleRegister = async () => {
    if (isRegistered) { toast.error('Already registered for this event'); return; }
    setRegistering(true);
    try {
      const response = await apiCall('/registrations', {
        method: 'POST',
        body: JSON.stringify({ eventId, asVolunteer: false }),
      });
      if (response.success) {
        setIsRegistered(true);
        toast.success('Successfully registered!');
        setEvent((prev: any) => ({ ...prev, registeredCount: prev.registeredCount + 1 }));
      }
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const handleFeedback = async (rating: number) => {
    if (feedbackSubmitting) return;
    setFeedbackRating(rating);
    setFeedbackSubmitting(true);
    try {
      await apiCall('/event-operations/' + eventId + '/feedback', {
        method: 'POST',
        body: JSON.stringify({ eventRating: rating }),
      });
      setFeedbackSubmitted(true);
      toast.success('Thanks for your rating!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit rating.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleSubmitFeedbackForm = async () => {
    if (!myFeedbackForm?.questions || submittingFeedbackForm) return;
    const unanswered = myFeedbackForm.questions.filter((q) => {
      const a = feedbackFormAnswers[q.id];
      return q.type === 'RATING' ? a?.answerRating === undefined : !a?.answerText;
    });
    if (unanswered.length > 0) {
      toast.error('Please answer all questions before submitting.');
      return;
    }
    setSubmittingFeedbackForm(true);
    try {
      const answers = myFeedbackForm.questions.map((q) => feedbackFormAnswers[q.id]);
      await apiCall('/event-operations/' + eventId + '/feedback-form/submit', {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      toast.success('Feedback submitted!');
      await fetchMyFeedbackForm();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedbackForm(false);
    }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await apiCall('/event-operations/' + eventId + '/check-ins', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Check-in submitted! Awaiting verification.');
      await fetchCheckInStatus();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to check in.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!myQuiz?.questions || submittingQuiz) return;
    const unanswered = myQuiz.questions.filter((q) => !quizAnswers[q.id]);
    if (unanswered.length > 0) {
      toast.error('Please answer all questions before submitting.');
      return;
    }
    setSubmittingQuiz(true);
    try {
      const answers = myQuiz.questions.map((q) => ({ questionId: q.id, selectedOption: quizAnswers[q.id] }));
      const res = await apiCall('/event-operations/' + eventId + '/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      toast.success(`Quiz submitted — you scored ${res.data.score}/${res.data.maxScore}!`);
      await fetchMyQuiz();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit quiz.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  if (loading || !event) {
    return (
      <DashboardLayout user={user} loading={loading}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const isLive = isEventLive(event.startAt || (event.date + 'T' + event.time), event.endAt);
  const isLiveOrGrace = isEventLiveOrGrace(event.startAt || (event.date + 'T' + event.time), event.endAt);
  const graceActive = isGracePeriodActive(event.endAt);
  // Quiz and Feedback Form are independently applicable/mandatory — an event
  // can have neither, either, or both configured at once. Both unlock purely
  // on the server's attendance-verified signal (myQuiz/myFeedbackForm are
  // only ever fetched once checkIn is VERIFIED, so still being null here
  // means "not verified yet").
  const hasInBuiltQuiz = myQuiz?.available === true;
  const hasFeedbackForm = myFeedbackForm?.available === true;
  const quizCardUnlocked = hasInBuiltQuiz && !myQuiz!.locked;
  const feedbackCardUnlocked = hasFeedbackForm && !myFeedbackForm!.locked;
  const quizDone = !hasInBuiltQuiz || Boolean(myQuiz?.alreadySubmitted);
  const feedbackDone = !hasFeedbackForm || Boolean(myFeedbackForm?.alreadySubmitted);
  // Neither quiz nor feedback form configured -> this step is trivially done,
  // nothing to complete.
  const step3Done = quizDone && feedbackDone;
  // Word to use in step-3 copy — stays neutral until both myQuiz and
  // myFeedbackForm have actually been fetched (only happens post-verification).
  const bothKnown = myQuiz !== null && myFeedbackForm !== null;
  const step3Word = !bothKnown
    ? 'quiz/feedback'
    : hasInBuiltQuiz && hasFeedbackForm
    ? 'quiz and feedback'
    : hasInBuiltQuiz
    ? 'quiz'
    : hasFeedbackForm
    ? 'feedback'
    : 'quiz/feedback';
  // Quiz/feedback (in-built and external link) and rating now unlock purely
  // on session timing — halfway through start/end — instead of waiting on
  // an instructor to verify attendance first. The in-built cards get this
  // from the backend's `locked` flag (operation.service.js' isPastMidSession);
  // the external links and the rating card have no backend "locked" concept
  // of their own, so it's computed the same way here.
  const midSessionReached = isPastEventMidpoint(event.startAt || (event.date + 'T' + event.time), event.endAt);
  const isUpcoming = isEventUpcoming(event.startAt || (event.date + 'T' + event.time));
  // Registration allowed until 15 minutes after the event starts
  const regOpen = isRegistrationOpen(event.startAt || (event.date + 'T' + event.time));
  const isFull = event.registeredCount >= event.capacity && event.capacity > 0;

  // ─── LIVE EVENT PAGE (includes 30-min grace after endAt) ──────────
  if (isLiveOrGrace && (isRegistered || checkIn !== null)) {
    const isVerified = checkIn?.status === 'VERIFIED';
    const isPending = checkIn?.status === 'PENDING';
    const isRejected = checkIn?.status === 'REJECTED';
    const hasCheckedIn = !!checkIn;

    // Quiz/feedback link + rating unlock: session past its midpoint AND the
    // student has actually checked in (PENDING is enough, doesn't need to be
    // VERIFIED — see isPastMidSession/hasCheckedIn in operation.service.js).
    // The in-built quiz/feedback cards get the equivalent of this from the
    // backend's `locked` flag; the external links and rating card have no
    // such flag of their own, so it's computed the same way here.
    const tasksUnlocked = midSessionReached && hasCheckedIn && !isRejected;

    // Step indicator: 0 = not checked in (or rejected), 1 = pending verification,
    // 2 = verified but quiz/feedback not done, 3 = quiz/feedback done (rating up next)
    const step = !hasCheckedIn || isRejected ? 0 : isPending ? 1 : !step3Done ? 2 : 3;

    return (
      <DashboardLayout user={user} loading={false}>
        {/* Back button — navigates to a fixed destination rather than
            router.back(), which silently does nothing if this page was
            opened with no prior history entry (e.g. from a notification
            or a bookmarked/shared link). */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.push('/student/events')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Events</span>
        </motion.button>

        {/* ── Top bar: title + status badges ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {isLive ? (
              <motion.span
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold"
              >
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                LIVE NOW
              </motion.span>
            ) : graceActive ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold">
                <Clock className="w-3 h-3" />
                Session Ended · Quiz window closing in {Math.floor(graceSecsLeft / 60)}:{String(graceSecsLeft % 60).padStart(2, '0')}
              </span>
            ) : null}
            {isVerified && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Attendance Verified
              </motion.span>
            )}
            {isPending && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                Awaiting Verification
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-tight break-words">{event.title}</h1>

          {/* Course name — a proper sub-heading right under the workshop
              title (not just a small pill) so the student immediately
              knows which course this session belongs to, before they have
              to scroll or infer it from anything else. */}
          {event.courseName && (
            <p className="flex items-center gap-1.5 text-sm sm:text-base font-semibold text-violet-300 mt-1.5">
              <BookOpen className="w-4 h-4 shrink-0" /> {event.courseName}
            </p>
          )}
          <p className="text-white/40 text-sm mt-1">Organized by <span className="text-white/60">{event.organizer}</span></p>

          {/* Module / Batch */}
          {(event.moduleName || event.batch) && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 mt-3 text-xs sm:text-sm">
              {event.moduleName && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 font-medium">
                  {event.moduleName}
                </span>
              )}
              {event.batch && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-300 font-medium">
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" /> Batch {event.batch}
                </span>
              )}
            </div>
          )}

          {/* Instructor / Associate Instructor / Volunteers running this
              session — shown right under the course info so the student
              knows who to look for/contact, without digging into a modal. */}
          {(event.instructorName || event.associateInstructorName || event.volunteerNames?.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs sm:text-sm text-white/50">
              {event.instructorName && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                  Instructor: <span className="text-white/70 font-medium">{event.instructorName}</span>
                </span>
              )}
              {event.associateInstructorName && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  Associate: <span className="text-white/70 font-medium">{event.associateInstructorName}</span>
                </span>
              )}
              {event.volunteerNames?.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  Volunteer{event.volunteerNames.length > 1 ? 's' : ''}: <span className="text-white/70 font-medium">{event.volunteerNames.join(', ')}</span>
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* ── "Your task right now" banner — the stepper below shows overall
             progress, but doesn't tell a student AT A GLANCE what action is
             theirs to take right this moment. This makes that explicit,
             right under the title, before they have to read/interpret the
             stepper or scroll down to the cards themselves. Skipped once the
             post-session exit checklist (below) takes over the same job. */}
        {!showExitChecklist && (step === 0 || step === 2 || (step === 3 && !feedbackSubmitted)) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6 p-4 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(249,115,22,0.08))',
              border: '1px solid rgba(245,158,11,0.35)'
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0"
            >
              <Flag className="w-4.5 h-4.5 text-amber-400" />
            </motion.div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">Your task right now</p>
              <p className="text-sm sm:text-base font-semibold text-white truncate">
                {step === 0
                  ? 'Check in to this session'
                  : step === 2
                  ? `Complete the ${step3Word} below`
                  : `Rate this session to finish up`}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Post-session exit checklist — the session has ended (or the
             page loaded mid grace-window); make sure the student sees a
             final checklist and can't leave without at least rating. ── */}
        {showExitChecklist && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 sm:p-5 rounded-2xl border border-primary/25"
            style={{ background: 'rgba(108,99,255,0.06)' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Award className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Session has ended</p>
                <p className="text-xs text-white/50 mt-0.5">
                  Before you go, make sure you&apos;ve checked in and rated this session.
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {[
                { label: 'Checked in', done: hasCheckedIn },
                ...(bothKnown && !hasInBuiltQuiz && !hasFeedbackForm
                  ? []
                  : [{
                      label: !bothKnown
                        ? 'Quiz/feedback completed'
                        : hasInBuiltQuiz && hasFeedbackForm
                        ? 'Quiz & feedback completed'
                        : hasInBuiltQuiz
                        ? 'Quiz completed'
                        : 'Feedback submitted',
                      done: step3Done,
                    }]),
                { label: 'Rating given', done: feedbackSubmitted },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  {item.done ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className={item.done ? 'text-white/70' : 'text-white/40'}>{item.label}</span>
                </div>
              ))}
            </div>

            {!step3Done ? (
              <p className="text-xs text-white/50 mb-4">Complete the {step3Word} below first, then rate the session to unlock &quot;Exit the Session&quot;.</p>
            ) : (
              <div className="mb-4">
                <p className="text-xs text-white/50 mb-2">
                  {feedbackSubmitted ? 'Your rating (tap to change):' : 'Rate this session to unlock "Exit the Session":'}
                </p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleFeedback(star)}
                      onMouseEnter={() => setFeedbackHover(star)}
                      onMouseLeave={() => setFeedbackHover(0)}
                      disabled={feedbackSubmitting}
                      className="p-0.5 disabled:opacity-50"
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          star <= (feedbackHover || feedbackRating) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (!step3Done || !feedbackSubmitted) {
                  toast.error(!step3Done ? `Please complete the ${step3Word} first.` : 'Please rate this session before exiting.');
                  return;
                }
                router.push('/student/events');
              }}
              disabled={!step3Done || !feedbackSubmitted}
              title={!step3Done || !feedbackSubmitted ? 'Complete the quiz/feedback and rating to exit' : undefined}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                step3Done && feedbackSubmitted
                  ? 'btn-primary'
                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
              }`}
            >
              {!(step3Done && feedbackSubmitted) && <Lock className="w-3.5 h-3.5" />}
              Exit the Session
            </button>
          </motion.div>
        )}

        {/* ── Step Progress Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-0 mb-7 p-3 sm:p-4 rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {[
            { label: 'Check In', icon: Fingerprint },
            { label: 'Verification', icon: Zap },
            { label: 'Quiz / Feedback', icon: FileText },
            { label: 'Rating', icon: Star },
          ].map((s, i) => (
            <div key={i} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                  step > i ? 'bg-emerald-500 text-white' :
                  step === i ? 'bg-primary/20 border-2 border-primary text-primary' :
                  'bg-white/5 border border-white/10 text-white/20'
                }`}>
                  {step > i
                    ? <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    : <s.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  }
                </div>
                <span className={`text-[9px] sm:text-[10px] mt-1.5 font-medium transition-colors text-center leading-tight px-0.5 ${
                  step > i ? 'text-emerald-400' : step === i ? 'text-primary' : 'text-white/25'
                }`}>{s.label}</span>
              </div>
              {i < 3 && (
                <div className="h-px flex-1 mx-0.5 sm:mx-1 transition-all duration-500 min-w-[8px]" style={{
                  background: step > i ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.08)'
                }} />
              )}
            </div>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ══════════════════════════════════════════════════════
              PHASE 2 — VERIFIED: Session Active
          ══════════════════════════════════════════════════════ */}
          {(hasCheckedIn && !isRejected) ? (
            <motion.div
              key="phase2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >
              {/* Verified Hero */}
              <div
                className="dark-surface-card relative rounded-2xl overflow-hidden p-4 sm:p-6 lg:p-8"
                style={{
                  background: 'linear-gradient(135deg, #061a0f 0%, #0a2016 50%, #061820 100%)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  boxShadow: '0 0 50px rgba(16,185,129,0.07)',
                }}
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -top-12 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
                  <div className="absolute -top-12 right-1/4 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${isVerified ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-amber-500/20 border border-amber-500/40'}`}
                    >
                      {isVerified
                        ? <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                        : <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                      }
                    </motion.div>
                    <div className="min-w-0">
                      <p className={`font-bold text-sm sm:text-base ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isVerified ? 'Attendance Confirmed' : 'Checked In'}
                      </p>
                      <p className="text-white/40 text-xs">
                        {isVerified ? 'Your presence has been verified by the instructor' : 'Verification pending — you can attempt the quiz now'}
                      </p>
                    </div>
                  </div>

                  {/* Info chips */}
                  <div className="flex flex-wrap gap-2 sm:gap-2.5">
                    {event.courseName && (
                      <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs">
                        <BookOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="text-white/70">{event.courseName}</span>
                      </div>
                    )}
                    {event.moduleName && (
                      <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs">
                        <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span className="text-white/70">{event.moduleName}</span>
                      </div>
                    )}
                    {event.batch && (
                      <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-white/70">{event.batch}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-white/70">{event.venue}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-white/70">{formatTime(event.time)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-white/70">{formatDate(event.date)}</span>
                    </div>
                  </div>

                  {/* Meeting link */}
                  {event.meetLink && (
                    <a
                      href={event.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                      style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', color: '#fff', boxShadow: '0 0 20px rgba(59,130,246,0.25)' }}
                    >
                      <Video className="w-4 h-4" /> Join Online Meeting
                    </a>
                  )}
                </div>
              </div>

              {/* Quiz / Feedback — step 3. Quiz and Feedback Form are
                  independently applicable — an event can have neither,
                  either, or both, rendered as separate cards. Each unlocks
                  once attendance is verified. */}
              {hasInBuiltQuiz && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="dark-surface-card relative rounded-2xl overflow-hidden"
                  style={{
                    background: quizCardUnlocked
                      ? 'linear-gradient(135deg, #1a0e04, #1f1408)'
                      : 'linear-gradient(135deg, #111, #1a1a1a)',
                    border: quizCardUnlocked
                      ? '1px solid rgba(249,115,22,0.4)'
                      : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: quizCardUnlocked ? '0 0 30px rgba(249,115,22,0.08)' : 'none',
                  }}
                >
                  <div className="p-4 sm:p-5 lg:p-6">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className={`w-5 h-5 shrink-0 ${quizCardUnlocked ? 'text-orange-400' : 'text-white/30'}`} />
                        <h2 className="text-white font-bold text-base truncate">
                          Session Quiz <span className="text-red-400">*</span>
                        </h2>
                      </div>
                      {myQuiz?.alreadySubmitted ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold shrink-0">
                          <CheckCircle className="w-3 h-3" /> SUBMITTED
                        </span>
                      ) : quizCardUnlocked ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold shrink-0">
                          <CheckCircle className="w-3 h-3" /> UNLOCKED
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30 text-[10px] font-bold shrink-0">
                          <Lock className="w-2.5 h-2.5" /> LOCKED
                        </span>
                      )}
                    </div>

                    {myQuiz!.locked ? (
                      <p className="text-white/30 text-sm mt-2 flex items-center gap-1.5">
                        <Lock className="w-3 h-3 shrink-0" />
                        The quiz unlocks once your attendance is verified.
                      </p>
                    ) : myQuiz!.alreadySubmitted ? (
                      <div className="mt-2">
                        <p className="text-white/60 text-sm mb-2">Quiz submitted — you scored:</p>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold text-white">{myQuiz!.score}</span>
                          <span className="text-white/40 text-base mb-0.5">/ {myQuiz!.maxScore}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-4">
                        <p className="text-white/40 text-sm">Attendance verified — answer all {myQuiz!.questions?.length} questions and submit.</p>
                        {graceActive && (
                          <p className="text-orange-400/80 text-xs -mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Quiz window closes in {Math.floor(graceSecsLeft / 60)}:{String(graceSecsLeft % 60).padStart(2, '0')}
                          </p>
                        )}
                        {myQuiz!.questions?.map((q, qi) => (
                          <div key={q.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                            <p className="text-white/85 text-sm font-medium mb-2.5">{qi + 1}. {q.questionText}</p>
                            <div className="flex flex-col gap-2">
                              {QUIZ_OPTION_KEYS.map((key) => {
                                const optionText = q[QUIZ_OPTION_FIELD[key]];
                                const selected = quizAnswers[q.id] === key;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: key }))}
                                    className={`text-left px-3 py-2 rounded-lg text-sm border transition-all ${
                                      selected
                                        ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                                        : 'bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/5'
                                    }`}
                                  >
                                    <span className="font-semibold mr-1.5">{key}.</span>{optionText}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        <motion.button
                          whileHover={{ scale: submittingQuiz ? 1 : 1.02 }}
                          whileTap={{ scale: submittingQuiz ? 1 : 0.98 }}
                          onClick={handleSubmitQuiz}
                          disabled={submittingQuiz}
                          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)', color: '#fff', boxShadow: '0 0 20px rgba(249,115,22,0.3)' }}
                        >
                          {submittingQuiz ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit Quiz'}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {hasFeedbackForm && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="dark-surface-card relative rounded-2xl overflow-hidden"
                  style={{
                    background: feedbackCardUnlocked
                      ? 'linear-gradient(135deg, #150e2e 0%, #1c1240 50%, #150e2e 100%)'
                      : 'linear-gradient(135deg, #111, #1a1a1a)',
                    border: feedbackCardUnlocked
                      ? '1px solid rgba(139,124,255,0.4)'
                      : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: feedbackCardUnlocked ? '0 0 30px rgba(139,124,255,0.12)' : 'none',
                  }}
                >
                  <div className="p-4 sm:p-5 lg:p-6">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className={`w-5 h-5 shrink-0 ${feedbackCardUnlocked ? 'text-violet-400' : 'text-white/30'}`} />
                        <h2 className="text-white font-bold text-base truncate">
                          Session Feedback <span className="text-red-400">*</span>
                        </h2>
                      </div>
                      {myFeedbackForm?.alreadySubmitted ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold shrink-0">
                          <CheckCircle className="w-3 h-3" /> SUBMITTED
                        </span>
                      ) : feedbackCardUnlocked ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold shrink-0">
                          <CheckCircle className="w-3 h-3" /> UNLOCKED
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30 text-[10px] font-bold shrink-0">
                          <Lock className="w-2.5 h-2.5" /> LOCKED
                        </span>
                      )}
                    </div>

                    {myFeedbackForm!.locked ? (
                      <p className="text-white/30 text-sm mt-2 flex items-center gap-1.5">
                        <Lock className="w-3 h-3 shrink-0" />
                        Feedback unlocks once your attendance is verified.
                      </p>
                    ) : myFeedbackForm!.alreadySubmitted ? (
                      <p className="text-white/60 text-sm mt-2 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        Thanks — your feedback has been submitted.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-4">
                        <p className="text-white/40 text-sm">Attendance verified — answer all {myFeedbackForm!.questions?.length} question(s) and submit.</p>
                        {myFeedbackForm!.questions?.map((q, qi) => (
                          <div key={q.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                            <p className="text-white/85 text-sm font-medium mb-2.5">{qi + 1}. {q.questionText}</p>
                            {q.type === 'TEXT' && (
                              <textarea
                                value={feedbackFormAnswers[q.id]?.answerText || ''}
                                onChange={(e) => setFeedbackFormAnswers((prev) => ({ ...prev, [q.id]: { questionId: q.id, answerText: e.target.value } }))}
                                placeholder="Your answer"
                                rows={3}
                                className="input-dark w-full px-3 py-2 rounded-lg text-sm resize-none"
                              />
                            )}
                            {q.type === 'RATING' && (
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setFeedbackFormAnswers((prev) => ({ ...prev, [q.id]: { questionId: q.id, answerRating: s } }))}
                                  >
                                    <Star
                                      className={`w-6 h-6 transition-colors ${
                                        s <= (feedbackFormAnswers[q.id]?.answerRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                            {q.type === 'MCQ' && (
                              <div className="flex flex-col gap-2">
                                {FEEDBACK_MCQ_KEYS.map((key) => {
                                  const optionText = q[FEEDBACK_MCQ_FIELD[key]];
                                  if (!optionText) return null;
                                  const selected = feedbackFormAnswers[q.id]?.answerText === key;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => setFeedbackFormAnswers((prev) => ({ ...prev, [q.id]: { questionId: q.id, answerText: key } }))}
                                      className={`text-left px-3 py-2 rounded-lg text-sm border transition-all ${
                                        selected
                                          ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                                          : 'bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/5'
                                      }`}
                                    >
                                      <span className="font-semibold mr-1.5">{key}.</span>{optionText}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                        <motion.button
                          whileHover={{ scale: submittingFeedbackForm ? 1 : 1.02 }}
                          whileTap={{ scale: submittingFeedbackForm ? 1 : 0.98 }}
                          onClick={handleSubmitFeedbackForm}
                          disabled={submittingFeedbackForm}
                          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)', color: '#fff', boxShadow: '0 0 20px rgba(249,115,22,0.3)' }}
                        >
                          {submittingFeedbackForm ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit Feedback'}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* External quiz/feedback links — set via a CSV import or the
                  Module's "Quiz Link"/"Feedback Link" fields (a plain Google
                  Form URL, not the in-built Quiz/Feedback library). Shown
                  independently of hasInBuiltQuiz/hasFeedbackForm since a
                  session can have an external link with no in-built form
                  configured at all — and can ALSO have both an in-built form
                  (card above) and an external link at once, so the heading/
                  button labels are qualified with "(Google Form)" whenever
                  the in-built counterpart is also present, to avoid reading
                  as a duplicate of the "Session Quiz"/"Session Feedback" card. */}
              {(event.quizLink || event.feedbackLink) && (
                <div
                  className="dark-surface-card rounded-2xl p-5 lg:p-6 space-y-3"
                  style={{
                    background: 'linear-gradient(135deg, #12121c, #191924)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-primary" /> External Form Link{event.quizLink && event.feedbackLink ? 's' : ''}
                  </h3>
                  {!tasksUnlocked ? (
                    <p className="text-white/30 text-sm flex items-center gap-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      {!hasCheckedIn || isRejected ? 'Check in to this session to unlock.' : 'Unlocks once the session is halfway through.'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {event.quizLink && (
                        <a
                          href={event.quizLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)', color: '#fff', boxShadow: '0 0 20px rgba(249,115,22,0.25)' }}
                        >
                          <ExternalLink className="w-4 h-4" /> Open Quiz{hasInBuiltQuiz ? ' (Google Form)' : ''}
                        </a>
                      )}
                      {event.feedbackLink && (
                        <a
                          href={event.feedbackLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 transition-all"
                        >
                          <ExternalLink className="w-4 h-4" /> Open Feedback Form{hasFeedbackForm ? ' (Google Form)' : ''}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!hasInBuiltQuiz && !hasFeedbackForm && !event.quizLink && !event.feedbackLink && bothKnown && (
                <div
                  className="dark-surface-card rounded-2xl p-5 lg:p-6 text-white/30 text-sm"
                  style={{
                    background: 'linear-gradient(135deg, #12121c, #191924)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  No quiz or feedback form is required for this session.
                </div>
              )}

              {/* Rating — step 4. Always a separate, mandatory, and repeatedly
                  editable step, only reachable once quiz/feedback is done. */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-card rounded-2xl p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Star className="w-4 h-4 text-yellow-400 shrink-0" />
                    <h3 className="text-base font-bold text-white truncate">Rate This Session <span className="text-red-400">*</span></h3>
                  </div>
                  {feedbackSubmitted && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold shrink-0">
                      <CheckCircle className="w-3 h-3" /> RATED
                    </span>
                  )}
                </div>
                {!tasksUnlocked ? (
                  <p className="text-white/30 text-sm flex items-center gap-1.5">
                    <Lock className="w-3 h-3 shrink-0" />
                    {!hasCheckedIn || isRejected ? 'Check in to this session to unlock rating.' : 'Rating unlocks once the session is halfway through.'}
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-white/40 text-sm">
                      {feedbackSubmitted ? 'You rated this session — tap to change:' : 'How was this session?'}
                    </p>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(s => (
                        <motion.button
                          key={s}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onMouseEnter={() => setFeedbackHover(s)}
                          onMouseLeave={() => setFeedbackHover(0)}
                          onClick={() => handleFeedback(s)}
                          disabled={feedbackSubmitting}
                        >
                          <Star className={`w-8 h-8 transition-all ${s <= (feedbackHover || feedbackRating) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`} />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Legacy module-marks score (bulk-imported CSV marks, unrelated
                  to the in-built Quiz library) — only shown when it ISN'T
                  already covered by the Session Quiz card above, so the same
                  score never appears twice on the page. */}
              {!hasInBuiltQuiz && quizScore && quizScore.totalMarks !== null && (() => {
                const passed = quizScore.totalMarks >= 3;
                const pct = Math.round((quizScore.totalMarks / (quizScore.totalMax || 1)) * 100);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="dark-surface-card rounded-2xl p-4 sm:p-5"
                    style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)', border: '1px solid rgba(99,102,241,0.35)', boxShadow: '0 0 25px rgba(99,102,241,0.08)' }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Award className="w-5 h-5 text-indigo-400 shrink-0" />
                        <h2 className="text-white font-bold text-base truncate">Module Score</h2>
                      </div>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${passed ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400' : 'bg-red-500/15 border border-red-500/25 text-red-400'}`}>
                        {passed ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {passed ? 'Completed' : 'Below Minimum'}
                      </span>
                    </div>
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-4xl font-bold text-white">{quizScore.totalMarks}</span>
                      <span className="text-white/40 text-lg mb-1">/ {quizScore.totalMax}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg,#6366f1,#818cf8)' }}
                      />
                    </div>
                    <p className="text-white/40 text-xs mt-2">
                      {pct}% score {!passed && '— minimum score of 3 required'}
                    </p>
                  </motion.div>
                );
              })()}

              {/* About + Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ y: -2 }}
                  className="glass-card rounded-2xl p-5 transition-shadow hover:shadow-card-hover"
                >
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-gradient-to-b from-primary to-accent" />
                    About This Session
                  </h3>
                  <p className="text-white/55 text-sm leading-relaxed">
                    {event.description || 'An interactive session designed to enhance your wellbeing and personal growth.'}
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  whileHover={{ y: -2 }}
                  className="glass-card rounded-2xl p-5 transition-shadow hover:shadow-card-hover"
                >
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-gradient-to-b from-primary to-accent" />
                    Session Details
                  </h3>
                  <div className="space-y-3">
                    {[
                      { icon: Calendar, label: formatDate(event.date) },
                      { icon: Clock, label: formatTime(event.time) },
                      { icon: MapPin, label: event.venue },
                      { icon: Users, label: `${event.registeredCount}${event.capacity > 0 ? `/${event.capacity}` : ''} participants` },
                    ].map(({ icon: Icon, label }, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="text-white/60">{label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>

          ) : (
            /* ══════════════════════════════════════════════════════
                PHASE 1 — CHECK-IN / PENDING
            ══════════════════════════════════════════════════════ */
            <motion.div
              key="phase1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-1 lg:grid-cols-5 gap-5"
            >
              {/* Left: Check-in card (wider) */}
              <div className="lg:col-span-3 space-y-4">
                {/* Check-in / Pending card */}
                <div
                  className="dark-surface-card relative rounded-2xl overflow-hidden"
                  style={{
                    background: isPending
                      ? 'linear-gradient(135deg, #1a1400, #1f1800)'
                      : 'linear-gradient(135deg, #0f0f23, #1a0a2e)',
                    border: isPending
                      ? '1px solid rgba(245,158,11,0.35)'
                      : '1px solid rgba(239,68,68,0.25)',
                    boxShadow: isPending
                      ? '0 0 40px rgba(245,158,11,0.06)'
                      : '0 0 40px rgba(239,68,68,0.08)',
                  }}
                >
                  <div className="absolute inset-0 pointer-events-none">
                    <div className={`absolute -top-16 left-1/4 w-64 h-64 rounded-full blur-3xl ${isPending ? 'bg-amber-500/5' : 'bg-violet-500/5'}`} />
                    <div className={`absolute -top-16 right-1/4 w-64 h-64 rounded-full blur-3xl ${isPending ? 'bg-yellow-500/5' : 'bg-red-500/5'}`} />
                  </div>

                  <div className="relative p-4 sm:p-6 lg:p-8">
                    <AnimatePresence mode="wait">
                      {/* ── NOT CHECKED IN ── */}
                      {(!hasCheckedIn || isRejected) && (
                        <motion.div
                          key="checkin-btn"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center gap-6 py-4"
                        >
                          {isRejected && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                            >
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              Check-in was rejected — tap to try again
                            </motion.div>
                          )}

                          <div className="text-center">
                            <p className="text-white/70 text-base font-medium mb-1">Mark Your Attendance</p>
                            <p className="text-white/35 text-sm">Tap the button below to check in</p>
                          </div>

                          {/* Big check-in button */}
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleCheckIn}
                            disabled={checkingIn}
                            className="relative flex flex-col items-center justify-center w-36 h-36 sm:w-48 sm:h-48 rounded-full transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                              background: 'rgba(16,185,129,0.08)',
                              border: '2px solid rgba(16,185,129,0.4)',
                              boxShadow: '0 0 50px rgba(16,185,129,0.15)',
                            }}
                          >
                            {!checkingIn && (
                              <>
                                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }} transition={{ repeat: Infinity, duration: 2.5 }} className="absolute inset-0 rounded-full border border-emerald-500/25" />
                                <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0, 0.2] }} transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }} className="absolute inset-0 rounded-full border border-emerald-500/15" />
                              </>
                            )}
                            {checkingIn
                              ? <Loader2 className="w-10 h-10 sm:w-14 sm:h-14 text-emerald-400 animate-spin" />
                              : <Fingerprint className="w-10 h-10 sm:w-14 sm:h-14 text-emerald-400" />
                            }
                            <span className="mt-2 sm:mt-3 text-emerald-400 font-bold text-sm sm:text-base">
                              {checkingIn ? 'Checking in…' : 'Check In'}
                            </span>
                          </motion.button>
                        </motion.div>
                      )}

                      {/* ── PENDING VERIFICATION ── */}
                      {isPending && (
                        <motion.div
                          key="pending"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex flex-col items-center gap-5 py-4"
                        >
                          {/* Animated spinner */}
                          <div className="relative w-28 h-28">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                              className="absolute inset-0 rounded-full border-2 border-amber-500/20 border-t-amber-400"
                            />
                            <motion.div
                              animate={{ rotate: -360 }}
                              transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                              className="absolute inset-2 rounded-full border border-amber-500/10 border-b-amber-500/40"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Zap className="w-10 h-10 text-amber-400" />
                            </div>
                          </div>

                          <div className="text-center">
                            <p className="text-amber-400 font-bold text-xl mb-1.5">Verification in Progress</p>
                            <p className="text-white/50 text-sm">Associate Instructor is reviewing your check-in</p>
                          </div>

                          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/8 border border-amber-500/15 text-amber-400/60 text-xs">
                            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                            Page updates automatically every 2 seconds
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* About */}
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">About This Session</h3>
                  <p className="text-white/55 text-sm leading-relaxed">
                    {event.description || 'An interactive session designed to enhance your wellbeing and personal growth.'}
                  </p>
                </div>
              </div>

              {/* Right: Event info + locked quiz */}
              <div className="lg:col-span-2 space-y-4">
                {/* Event info card */}
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Session Info</h3>
                  <div className="space-y-3">
                    {[
                      { icon: Calendar, label: 'Date', value: formatDate(event.date) },
                      { icon: Clock, label: 'Started at', value: formatTime(event.time) },
                      { icon: MapPin, label: 'Venue', value: event.venue },
                      ...(event.courseName ? [{ icon: BookOpen, label: 'Course', value: event.courseName }] : []),
                      ...(event.batch ? [{ icon: GraduationCap, label: 'Batch', value: event.batch }] : []),
                      { icon: Users, label: 'Participants', value: `${event.registeredCount}${event.capacity > 0 ? `/${event.capacity}` : ''}` },
                    ].map(({ icon: Icon, label, value }, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
                          <p className="text-sm text-white/75 font-medium">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quiz — LOCKED */}
                <div
                  className="rounded-2xl p-5 opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-white/30" />
                      <h3 className="text-sm font-semibold text-white/50">Session Quiz</h3>
                    </div>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/25 text-[10px] font-bold">
                      <Lock className="w-2.5 h-2.5" /> LOCKED
                    </span>
                  </div>
                  <p className="text-white/25 text-xs">Get verified by the instructor to unlock the quiz.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    );
  }

  // ─── STANDARD EVENT PAGE (not live / not registered) ───────────────
  return (
    <DashboardLayout user={user} loading={false}>
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => router.push('/student/events')}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Events</span>
      </motion.button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative h-64 rounded-2xl overflow-hidden">
            {bannerError ? (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30" />
            ) : (
              <img
                src={`https://source.unsplash.com/800x400/?workshop,meditation,wellness,${encodeURIComponent(event.title.split(' ').slice(0, 2).join(' '))}`}
                alt={event.title}
                className="w-full h-full object-cover"
                onError={() => setBannerError(true)}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {isLive && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-sm font-semibold flex items-center gap-2">
                <div className="w-2 h-2 bg-[#ffffff] rounded-full animate-pulse" /> LIVE NOW
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4">
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">{event.title}</h1>
              <p className="text-white/80 text-sm">Organized by {event.organizer}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">About This Event</h2>
            <p className="text-white/70 leading-relaxed">
              {event.description || 'Join us for an amazing workshop experience.'}
            </p>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Event Details</h3>
            <div className="space-y-4">
              {[
                { icon: Calendar, label: 'Date', value: formatDate(event.date) },
                { icon: Clock, label: 'Time', value: formatTime(event.time) },
                { icon: MapPin, label: 'Venue', value: event.venue },
                { icon: Users, label: 'Participants', value: `${event.registeredCount}${event.capacity > 0 ? `/${event.capacity}` : ''} registered` },
              ].map(({ icon: Icon, label, value }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-white font-medium">{value}</p>
                    <p className="text-white/50 text-sm">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRegister}
                disabled={isRegistered || isFull || registering || !regOpen}
                className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  isRegistered ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                  : isFull ? 'bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed'
                  : !regOpen ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30 cursor-not-allowed'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                }`}
              >
                {registering ? <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Registering…</>
                // Reaching this branch already means isLiveOrGrace is false (the live/grace
                // view above returns first) — so a registered event that isn't upcoming has
                // fully finished (past its grace window too), not just "registered".
                : isRegistered ? (isUpcoming
                    ? <><CheckCircle className="w-4 h-4" /> Registered</>
                    : <><CheckCircle className="w-4 h-4" /> Session Completed</>)
                : isFull ? <><AlertCircle className="w-4 h-4" /> Event Full</>
                : regOpen ? 'Register Now'
                : isLive ? <><AlertCircle className="w-4 h-4" /> Registration Closed</>
                : <><AlertCircle className="w-4 h-4" /> Event Ended</>}
              </motion.button>

              {event.meetLink && isRegistered && (
                <a href={event.meetLink} target="_blank" rel="noopener noreferrer"
                  className="w-full px-4 py-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  <ExternalLink className="w-4 h-4" /> Join Meeting
                </a>
              )}
            </div>
          </motion.div>

          {/* Rate — completed + present */}
          {!isUpcoming && !isLive && myAttendanceRec?.status === 'PRESENT' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white">Rate this Event</h3>
              </div>
              {feedbackSubmitted && (
                <p className="text-white/40 text-xs text-center mb-2">Your rating is saved — tap to change</p>
              )}
              <div className="flex justify-center gap-2">
                {[1,2,3,4,5].map(s => (
                  <motion.button key={s} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setFeedbackHover(s)} onMouseLeave={() => setFeedbackHover(0)}
                    onClick={() => handleFeedback(s)} disabled={feedbackSubmitting}
                  >
                    <Star className={`w-7 h-7 transition-all ${s <= (feedbackHover || feedbackRating) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`} />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
