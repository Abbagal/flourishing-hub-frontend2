'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, Clock, MapPin, Users, BookOpen, PlayCircle, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import StatCard from '@/components/StatCard';
import MiniCalendar from '@/components/MiniCalendar';
import DataTable from '@/components/DataTable';
import { getCurrentUser, apiCall, transformUserData } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { isEventLiveOrGrace, isEventUpcoming } from '@/lib/dateUtils';
import { useNowTick } from '@/lib/useNowTick';
import { getRegistrationMetrics, getRegisteredEventIds } from '@/lib/registrationUtils';
import type { CompletedEvent, AuthPayload } from '@/types';
import toast from 'react-hot-toast';

function RadialProgress({ percentage, size = 80 }: { percentage: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percentage / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="8" className="stroke-white/10" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="stroke-primary transition-all duration-700"
      />
    </svg>
  );
}

function CompletedEventCard({ event }: { event: CompletedEvent }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="glass-card rounded-2xl p-4 cursor-default relative overflow-hidden hover:shadow-xl transition-all duration-300"
    >
      {/* Hover Glow Effect */}
      <div className={`absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 opacity-0 transition-opacity duration-300 ${hovered ? 'opacity-100' : ''}`} />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold text-white line-clamp-2">{event.title}</h4>
          <span className="badge-green text-[10px] shrink-0">✓ Done</span>
        </div>
        <p className="text-xs text-white/40 mb-3">{formatDate(event.date)}</p>
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 6 }}
          transition={{ duration: 0.2 }}
          className="space-y-1.5"
        >
          {event.marks != null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Score</span>
              <span className="font-semibold text-white">{event.marks}/{event.maxMarks}</span>
            </div>
          )}
        </motion.div>
        {!hovered && <p className="text-[10px] text-white/25 mt-2">Hover to see details</p>}
      </div>
    </motion.div>
  );
}

export default function StudentDashboard() {
  useNowTick();
  // Past Records is hidden by default — only shown when the sidebar's
  // "Attendance" link (`/student#attendance`) is active, so it doesn't
  // clutter the main dashboard view.
  const [showPastRecords, setShowPastRecords] = useState(false);
  useEffect(() => {
    const checkHash = () => setShowPastRecords(window.location.hash === '#attendance');
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);
  const [user, setUser] = useState<AuthPayload | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeredEvents, setRegisteredEvents] = useState<string[]>([]);
  const [registeringEventIds, setRegisteringEventIds] = useState<string[]>([]);
  const [bundleProgress, setBundleProgress] = useState<any[]>([]);
  const [eventsFilter, setEventsFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const sliderRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch user data, events, and registrations from backend API
  useEffect(() => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      console.log("❌ No token found in localStorage");
      setLoading(false);
      return;
    }

    const fetchData = async (showSpinner: boolean) => {
      // ✅ CRITICAL: Add timeout to prevent stuck loading — only warns/spins
      // on the initial load; a silent background refresh (see visibilitychange
      // below) shouldn't pop an error toast just because it's mid-flight.
      // 40s — the retry loop below (now capped at 2 attempts, see comment
      // there) can take up to ~2x10s (each attempt can take up to the
      // backend's own connection-pool timeout to fail) plus its jittered
      // backoff (~3-4.5s), so anything much under that risks firing mid-retry
      // and showing this error even though the retry would have succeeded
      // moments later.
      const timeoutId = showSpinner ? setTimeout(() => {
        console.log("⚠️ Student dashboard API timeout - setting loading to false");
        setLoading(false);
        toast.error('Loading timeout. Please refresh the page.');
      }, 40000) : undefined;
      try {
        // 🚀 OPTIMIZATION: Use cached user data if available, but also fetch fresh data
        const cachedUser = localStorage.getItem("user");
        if (cachedUser) {
          try {
            const userData = JSON.parse(cachedUser);
            setUser(userData);
            console.log("✅ Using cached user data:", userData.name);
          } catch (e) {
            console.log("⚠️ Invalid cached user data, fetching fresh");
          }
        }
        
        // Always fetch fresh user data from backend to ensure profile is up-to-date
        console.log("🔄 Fetching fresh user data from API...");
        const userResponse = await getCurrentUser();
        const freshUserData = userResponse?.data?.data || userResponse?.data || userResponse;
        
        // Transform and set fresh user data (shared helper — null-safe via optional chaining)
        const transformedUser = transformUserData(freshUserData);

        setUser(transformedUser);
        
        // Update localStorage with fresh data
        localStorage.setItem("user", JSON.stringify(transformedUser));
        console.log("✅ Fresh user data loaded and cached:", transformedUser.name);

        // Fetch events filtered by student's batch (cohort) — batch events only visible to their batch
        const studentBatch = freshUserData.studentProfile?.cohort;
        const batchParam = studentBatch !== undefined ? `&batch=${studentBatch || ''}` : '';

        // activeOnly=false + from=24h-ago: without this, the backend drops
        // any event whose endAt already passed — a workshop a student still
        // needed to check into (grace window 45 min, check-in up to 6h
        // same-day) vanished from this dashboard the moment it ended.
        // Bounded to the last 24h so this doesn't pull the entire history.
        const eventsFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch events, registrations, attendance, and bundle progress in
        // parallel — retried with backoff. Under DB connection-pool
        // pressure (e.g. a signup burst), these calls can transiently 500;
        // without a retry that showed the student "refresh the page" and an
        // empty dashboard even though a second attempt moments later would
        // have succeeded fine.
        //
        // Capped at 2 attempts (was 3) with a longer, jittered backoff (was
        // a flat 1s/2s). During the 14 Aug incident, production logs showed
        // client-side timeouts (499s) persisting ~10-15 minutes AFTER the
        // database-side P2024 errors had already stopped — evidence that
        // retries from hundreds of students, all backing off on the same
        // fixed 1s/2s schedule, were re-hitting the pool in near-lockstep
        // and prolonging the backlog instead of just riding it out. A
        // higher, randomized delay spreads retries out instead of
        // re-synchronizing them.
        let attempt = 0;
        let fetchResults: any;
        while (true) {
          try {
            fetchResults = await Promise.all([
              apiCall(`/events?limit=200&activeOnly=false&from=${encodeURIComponent(eventsFrom)}${batchParam}`),
              apiCall('/registrations/me'),
              apiCall('/event-operations/attendance/me').catch(() => ({ data: [] })),
              apiCall('/student/bundle-progress').catch(() => ({ data: [] })),
            ]);
            break;
          } catch (retryErr: any) {
            attempt++;
            if (attempt >= 2 || retryErr?.status === 401) throw retryErr;
            const jitter = Math.random() * 1500;
            await new Promise((r) => setTimeout(r, attempt * 3000 + jitter));
          }
        }
        const [eventsResponse, registrationsResponse, attendanceResponse, bundleResponse] = fetchResults;
        setBundleProgress(bundleResponse.data || []);
        
        console.log("📦 Student events received:", eventsResponse);
        console.log("📦 User registrations received:", registrationsResponse);
        
        // Transform events to match frontend format
        const transformedEvents = eventsResponse.data.items.map((event: any) => {
          try {
            const startDate = new Date(event.startAt);
            return {
              id: event.id,
              title: event.title || 'Untitled Event',
              description: event.description || '',
              startAt: event.startAt,
              endAt: event.endAt || null,
              date: startDate.toISOString().split('T')[0],
              time: startDate.toTimeString().slice(0, 5),
              venue: event.venue || 'TBD',
              mode: event.meetLink ? 'Online' : 'In Classroom',
              capacity: event.capacity || 0,
              registeredCount: event._count?.registrations || 0,
              status: event.status?.toLowerCase() || 'draft',
              organizer: event.createdBy?.name || 'Admin',
              course: event.course || null,
            };
          } catch (error) {
            console.error("❌ Error transforming event:", event, error);
            return {
              id: event.id || 'unknown',
              title: event.title || 'Untitled Event',
              description: event.description || '',
              startAt: event.startAt || null,
              endAt: event.endAt || null,
              date: '2026-05-04',
              time: '10:00',
              venue: event.venue || 'TBD',
              mode: 'In Classroom',
              capacity: 0,
              registeredCount: 0,
              status: 'draft',
              organizer: 'Admin'
            };
          }
        });
        
        setEvents(transformedEvents);
        console.log("✅ Student events loaded:", transformedEvents.length);

        // Process registrations data
        const userRegistrations = registrationsResponse.data || [];
        setRegistrations(userRegistrations);
        setAttendanceRecords(attendanceResponse.data || []);
        
        // 🔥 FIX: Use safe registration utilities (eliminates duplicate logic)
        const registrationMetrics = getRegistrationMetrics(userRegistrations);
        const registeredEventIds = getRegisteredEventIds(userRegistrations);
        setRegisteredEvents(registeredEventIds);
        
        console.log("✅ User registrations loaded:", userRegistrations.length);
        console.log("🔍 Active registrations:", registrationMetrics.activeCount);
        console.log("🔍 Active registered event IDs:", registeredEventIds);
        
      } catch (err: any) {
        console.error("❌ Data fetch failed:", err);
        // Only surface this on the initial load — a failed silent background
        // refresh (showSpinner=false) shouldn't pop an error toast while the
        // student is just switching tabs/going back.
        if (showSpinner && err.status !== 401) {
          toast.error('Failed to load dashboard data. Please refresh the page.');
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId); // Clear the timeout
        setLoading(false);
      }
    };

    fetchData(true);

    // Browser back/forward (and some tab-switch cases) can restore this page
    // from Next.js's client-side router cache without re-running this effect,
    // so a workshop that went live/ended while the student was on its detail
    // page kept showing whatever was fetched on the ORIGINAL visit here. A
    // silent refetch (no spinner/timeout-toast) whenever the page becomes
    // visible again keeps the dashboard current without disturbing anything else.
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(false); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);

  // Calculate active and upcoming events using actual startAt/endAt
  const now = new Date();

  // Active event: currently happening (uses real endAt from backend)
  const activeEvent = events.find(event => {
    return isEventLiveOrGrace(event.startAt || (event.date + 'T' + event.time), event.endAt);
  });

  // Upcoming events: future events
  const upcomingEvents = events.filter(event => {
    return isEventUpcoming(event.startAt || (event.date + 'T' + event.time));
  });

  // 🔥 CRITICAL: Calculate registered events using safe utilities
  const registrationMetrics = getRegistrationMetrics(registrations);
  const { active: activeRegistrations, completed: completedRegistrations, totalParticipations } = registrationMetrics;

  const upcomingRegistered = activeRegistrations.filter(registration => {
    return isEventUpcoming(registration.event.startAt);
  }).map(registration => {
    // Transform registration.event to match frontend format
    const startDate = new Date(registration.event.startAt);
    return {
      id: registration.event.id,
      title: registration.event.title,
      description: registration.event.description || '',
      date: startDate.toISOString().split('T')[0],
      time: startDate.toTimeString().slice(0, 5),
      venue: registration.event.venue || 'TBD',
      mode: registration.event.meetLink ? 'Online' : 'In Classroom',
      capacity: registration.event.capacity || 0,
      registeredCount: registration.event._count?.registrations || 0,
      status: registration.event.status?.toLowerCase() || 'published',
      organizer: registration.event.createdBy?.name || 'Admin'
    };
  });

  // Calendar data based on real registrations (with safe mapping)
  const registeredEventDates = registrations
    .filter(reg => reg.event && reg.event.startAt)
    .map(reg => new Date(reg.event.startAt).toISOString().split('T')[0]);

  const unregisteredEventDates = events
    .filter((e) => !registeredEvents.includes(e.id))
    .map((e) => e.date);

  console.log("📊 Dashboard calculations:");
  console.log("🔴 Active event:", activeEvent?.title || "None");
  console.log("📋 Upcoming events:", upcomingEvents.length);
  console.log("✅ Active registrations:", activeRegistrations.length);
  console.log("✅ Registered upcoming:", upcomingRegistered.length);
  console.log("🎯 Completed registrations:", completedRegistrations.length);
  console.log("📈 Total participations:", totalParticipations);

  // Build lookup from attendance API response (includes marks + starRating from backend)
  const attendanceLookup: Record<string, any> = {};
  for (const rec of attendanceRecords) {
    attendanceLookup[rec.eventId] = rec;
  }

  // Past records table — real data from attendance API
  const pastRecords = attendanceRecords.map((rec: any) => {
    // Determine pass/fail: if marks recorded and < 3 → Failed; if PRESENT → Completed; else Absent/Excused
    let statusLabel = 'Absent';
    if (rec.status === 'EXCUSED') {
      statusLabel = 'Excused';
    } else if (rec.marks !== null && rec.marks !== undefined) {
      statusLabel = rec.marks >= 3 ? 'Completed' : 'Failed';
    } else if (rec.status === 'PRESENT') {
      statusLabel = 'Completed';
    }
    return {
      title: rec.eventTitle,
      date: formatDate(rec.date),
      venue: rec.venue || '—',
      marks: rec.marks != null && rec.maxMarks != null ? `${rec.marks}/${rec.maxMarks}` : '—',
      status: statusLabel,
    };
  });

  // Transform completed registrations to CompletedEvent format with real marks/ratings
  // Exclude events that are currently live (endAt not yet passed)
  const completedEvents: CompletedEvent[] = completedRegistrations
    .filter(registration => !isEventLiveOrGrace(registration.event.startAt, registration.event.endAt))
    .map(registration => {
    const attRec = attendanceLookup[registration.eventId];
    return {
      eventId: registration.eventId,
      title: registration.event.title,
      date: new Date(registration.event.startAt).toISOString().split('T')[0],
      venue: registration.event.venue || 'TBD',
      marks: attRec?.marks ?? undefined,
      maxMarks: attRec?.maxMarks ?? undefined,
      starRating: attRec?.starRating ?? undefined,
    };
  });

  const handleRegister = async (eventId: string) => {
    if (registeredEvents.includes(eventId)) {
      toast.error('Already registered for this event');
      return;
    }
    if (registeringEventIds.includes(eventId)) {
      return; // already in flight — ignore rapid double-clicks
    }

    const target = events.find(e => e.id === eventId);
    if (target && target.capacity > 0 && target.registeredCount >= target.capacity) {
      toast.error('Event is full - registration closed');
      return;
    }

    setRegisteringEventIds(prev => [...prev, eventId]);
    try {
      console.log("🔄 Registering for event:", eventId);

      const response = await apiCall('/registrations', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          asVolunteer: false
        })
      });

      if (response.success) {
        setRegisteredEvents(prev => [...prev, eventId]);
        // Keep the visible seat count in sync immediately instead of waiting for a reload
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, registeredCount: (e.registeredCount || 0) + 1 } : e));

        // Course-specific toast
        const registeredEvent = events.find(e => e.id === eventId);
        if (registeredEvent?.course) {
          const code = registeredEvent.course.code ? ` (${registeredEvent.course.code})` : '';
          toast.success(`Successfully registered for Course Bundle${code}!`, { duration: 4000 });
        } else {
          toast.success('Successfully registered for event!');
        }

        // Refresh registrations
        const registrationsResponse = await apiCall('/registrations/me');
        const updatedRegistrations = registrationsResponse.data || [];
        setRegistrations(updatedRegistrations);

        // Update registered event IDs
        const updatedRegisteredEventIds = getRegisteredEventIds(updatedRegistrations);
        setRegisteredEvents(updatedRegisteredEventIds);
      }
    } catch (error: any) {
      console.error("❌ Registration failed:", error);
      if (error?.message?.includes('already registered')) {
        toast.error('You are already registered for this event');
      } else if (error?.message?.includes('capacity is full')) {
        toast.error('Event is full - registration closed');
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setRegisteringEventIds(prev => prev.filter(id => id !== eventId));
    }
  };

  console.log("loading:", loading);
  console.log("user:", user);

  return (
    <DashboardLayout user={user} loading={loading}>
      {showPastRecords ? (
        /* Attendance view — replaces the whole dashboard with just Past
           Records, instead of showing it alongside everything else. */
        <div className="glass-card rounded-2xl p-6" id="attendance">
          <h2 className="text-base font-semibold text-white mb-4">Past Records</h2>
          {attendanceRecords.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No attendance records yet</p>
              <p className="text-white/25 text-xs mt-1">Attend events to see your attendance here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="hidden sm:grid grid-cols-5 gap-3 px-3 pb-2 border-b border-white/5">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Course</p>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Workshop</p>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Date & Time</p>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Status</p>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Score</p>
              </div>
              {attendanceRecords.map((record: any, i: number) => {
                const eventDate = new Date(record.date);
                const isPresent = record.status === 'PRESENT';
                const isExcused = record.status === 'EXCUSED';
                const isPending = record.status === 'PENDING';
                return (
                  <div key={record.eventId + i} className="grid grid-cols-2 sm:grid-cols-5 gap-y-2 gap-x-3 items-center p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                      <p className="text-xs text-white/70 sm:truncate">{record.courseName || 'Open Workshop'}</p>
                    </div>
                    <p className="text-xs text-white font-medium sm:truncate">{record.eventTitle}</p>
                    <div>
                      <p className="text-xs text-white/70">{eventDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold w-fit ${
                      isPresent
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : isExcused
                        ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                        : isPending
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isPresent ? 'bg-emerald-400' : isExcused ? 'bg-yellow-400' : isPending ? 'bg-amber-400' : 'bg-red-400'}`} />
                      {isPresent ? 'Present' : isExcused ? 'Excused' : isPending ? 'Attendance Verification In-progress' : 'Absent'}
                    </span>
                    <p className="text-xs text-white/60">
                      {record.marks != null ? `${record.marks}/${record.maxMarks}` : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0] || 'User'}</span>
          </h1>
          <div className="flex items-center flex-wrap gap-2 mt-2">
            <span className="text-sm text-white/50">
              {user?.programme || 'N/A'} · {user?.department || 'N/A'} · Year {user?.year || 'N/A'}
            </span>
            {(user as any)?.rollNo && (
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/40 text-[11px] font-mono">{(user as any).rollNo}</span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        className="grid grid-cols-2 gap-4"
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
          <StatCard title="Active Registrations" value={activeRegistrations.length} icon={Calendar} color="purple" />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
          <StatCard title="Completed Events" value={completedRegistrations.length} icon={CheckCircle} color="teal" />
        </motion.div>
      </motion.div>

      {/* 1-Hour Reminder Banner */}
      {(() => {
        const soonEvents = upcomingRegistered.filter(ev => {
          const diff = new Date(ev.startAt || (ev.date + 'T' + ev.time)).getTime() - now.getTime();
          return diff > 0 && diff <= 60 * 60 * 1000;
        });
        if (!soonEvents.length) return null;
        return (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300">Upcoming in less than 1 hour</p>
              <ul className="mt-1 space-y-0.5">
                {soonEvents.map(ev => {
                  const minsLeft = Math.max(1, Math.ceil((new Date(ev.startAt || (ev.date + 'T' + ev.time)).getTime() - now.getTime()) / 60000));
                  return (
                    <li key={ev.id} className="text-xs text-amber-200/80">
                      <span className="font-medium">{ev.title}</span>
                      {ev.venue && ev.venue !== 'TBD' && <span className="text-amber-200/50"> — {ev.venue}</span>}
                      <span className="text-amber-400 ml-1">({minsLeft} min)</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        );
      })()}

      {/* Bundle Progress */}
      {bundleProgress.length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Course Bundle Progress</h2>
            <span className="text-xs text-white/40">{bundleProgress.length} bundle{bundleProgress.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {bundleProgress.map((bundle: any) => (
              <motion.div
                key={bundle.courseId}
                whileHover={{ y: -2 }}
                className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 relative"
              >
                {bundle.isCompulsory && (
                  <span className="absolute top-2 right-2 text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">Required</span>
                )}
                <div className="relative flex items-center justify-center">
                  <RadialProgress percentage={bundle.percentage} size={72} />
                  <span className="absolute text-sm font-bold text-white">{bundle.percentage}%</span>
                </div>
                <p className="text-xs font-semibold text-white text-center line-clamp-2">{bundle.courseName}</p>
                <div className="flex gap-1 flex-wrap justify-center">
                  {Array.from({ length: bundle.totalWorkshops }).map((_, idx) => {
                    // Order: confirmed-attended squares first, then any
                    // self-checked-in-but-unverified ones, then genuinely
                    // not-yet-attended — a pending check-in isn't a no-show,
                    // so it gets its own square instead of looking identical
                    // to one (see verificationPending on the home page for
                    // the same distinction).
                    const isAttended = idx < bundle.attended;
                    const isPending = !isAttended && idx < bundle.attended + (bundle.pendingVerification || 0);
                    const label = isAttended ? 'Attended' : isPending ? 'Attendance Verification In-progress' : 'Not yet attended';
                    return (
                      <span key={idx} className="text-base leading-none" title={label}>
                        {isAttended ? '🟩' : isPending ? '🟨' : '⬜'}
                      </span>
                    );
                  })}
                </div>
                <p className="text-[10px] text-white/40">
                  {bundle.attended} of {bundle.totalWorkshops} workshops
                  {bundle.pendingVerification > 0 && <span className="text-amber-400"> · {bundle.pendingVerification} attendance verification in-progress</span>}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Status */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-4">Event Status</h2>

            {/* Live Events - NEW SECTION */}
            {events.filter(event => isEventLiveOrGrace(event.startAt || (event.date + 'T' + event.time), event.endAt)).length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  Live Events
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide mb-6">
                  {events.filter(event => isEventLiveOrGrace(event.startAt || (event.date + 'T' + event.time), event.endAt)).map((event) => (
                    <div 
                      key={event.id} 
                      className="flex-shrink-0 w-72 p-3 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 transition-all cursor-pointer"
                      onClick={() => router.push(`/student/events/${event.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4 text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{event.title}</p>
                          <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(event.date)}, {formatTime(event.time)}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.venue?.split(',')[0] || 'TBD'}</span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/30 text-red-400 text-[10px] font-semibold shrink-0">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                          LIVE
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Completed Events */}
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Completed Events</h3>
            {completedEvents.length === 0 ? (
              <div className="text-center py-6 text-white/30 text-sm">No completed events yet</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {completedEvents.map((event) => (
                  <CompletedEventCard key={event.eventId} event={event} />
                ))}
              </div>
            )}

            {/* Upcoming Events */}
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Upcoming Registered Events</h3>
            {upcomingRegistered.length === 0 ? (
              <div className="text-center py-6 text-white/30 text-sm">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming registered events</p>
                <p className="text-xs text-white/20 mt-1">Register for events to see them here</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {upcomingRegistered.map((event) => (
                  <div 
                    key={event.id} 
                    className="flex-shrink-0 w-72 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all cursor-pointer"
                    onClick={() => router.push(`/student/events/${event.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{event.title}</p>
                        <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(event.date)}, {formatTime(event.time)}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.venue?.split(',')[0] || 'TBD'}</span>
                        </div>
                      </div>
                      <span className="badge-purple text-[10px] shrink-0">Registered</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Upcoming Events to Register */}
          {(() => {
            const allSliderEvents = [...(activeEvent ? [activeEvent] : []), ...upcomingEvents];
            const filteredSliderEvents = eventsFilter === 'registered'
              ? allSliderEvents.filter(e => registeredEvents.includes(e.id))
              : eventsFilter === 'unregistered'
              ? allSliderEvents.filter(e => !registeredEvents.includes(e.id))
              : allSliderEvents;

            const slide = (dir: 'left' | 'right') => {
              if (!sliderRef.current) return;
              sliderRef.current.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
            };

            return (
              <div className="glass-card rounded-2xl p-5">
                {/* Header row — h2 and controls stack on mobile instead of
                    cramming three filter pills + two arrow buttons onto the
                    same line as the heading, which forced everything down
                    to near-unreadable/untappable sizes on narrow screens. */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                  <h2 className="text-base font-semibold text-white">All Events</h2>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    {/* Filter pills — horizontally scrollable as a safety
                        net if they still don't all fit on very narrow screens */}
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                      {(['all', 'registered', 'unregistered'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setEventsFilter(f)}
                          className={`shrink-0 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold border transition-all ${
                            eventsFilter === f
                              ? f === 'registered'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : f === 'unregistered'
                                ? 'bg-accent/20 text-accent border-accent/40'
                                : 'bg-primary/20 text-primary border-primary/40'
                              : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60'
                          }`}
                        >
                          {f === 'all' ? `All (${allSliderEvents.length})` : f === 'registered' ? `Registered (${allSliderEvents.filter(e => registeredEvents.includes(e.id)).length})` : `Unregistered (${allSliderEvents.filter(e => !registeredEvents.includes(e.id)).length})`}
                        </button>
                      ))}
                    </div>
                    {/* Scroll arrows */}
                    <div className="flex gap-1 ml-1 shrink-0">
                      <button onClick={() => slide('left')} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/50 hover:text-white transition-all">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => slide('right')} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/50 hover:text-white transition-all">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Slider */}
                <div ref={sliderRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
                  {filteredSliderEvents.map((event) => {
                    const isReg = registeredEvents.includes(event.id);
                    const isLive = isEventLiveOrGrace(event.startAt || (event.date + 'T' + event.time), event.endAt);
                    const isFull = !isReg && event.capacity > 0 && event.registeredCount >= event.capacity;
                    const isRegistering = registeringEventIds.includes(event.id);
                    return (
                      <motion.div
                        key={event.id}
                        whileHover={{ y: -4, scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                        className={`flex-shrink-0 w-52 rounded-xl overflow-hidden bg-white/[0.03] border transition-all cursor-pointer group ${
                          isLive ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/8 hover:border-primary/30 hover:shadow-card-hover'
                        }`}
                        onClick={() => router.push(`/student/events/${event.id}`)}
                      >
                        {/* Compact image */}
                        <div className="relative h-24 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/10 to-accent/25" />
                          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.15) 0%, transparent 45%)' }} />
                          {isLive && (
                            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-emerald-500/90 text-white text-[9px] font-bold flex items-center gap-1 z-10">
                              <div className="w-1.5 h-1.5 bg-[#ffffff] rounded-full animate-pulse" />LIVE
                            </div>
                          )}
                          {isReg && (
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-primary/80 text-white text-[9px] font-bold z-10 backdrop-blur-sm">✓ Reg</div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Calendar className="w-8 h-8 text-white/15 group-hover:scale-110 transition-transform duration-300" />
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Card body */}
                        <div className="p-3">
                          <p className="text-xs font-semibold text-white line-clamp-2 mb-2 leading-tight">{event.title}</p>
                          <div className="space-y-1 mb-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-white/45">
                              <Clock className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{formatDate(event.date)} · {formatTime(event.time)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-white/45">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{event.venue?.split(',')[0] || 'TBD'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-white/45">
                              <Users className="w-2.5 h-2.5 shrink-0" />
                              <span>{event.registeredCount}/{event.capacity || '∞'}</span>
                              {event.capacity > 0 && (
                                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden ml-1">
                                  <div
                                    className={`h-full rounded-full ${isFull ? 'bg-red-400' : 'bg-gradient-to-r from-primary to-accent'}`}
                                    style={{ width: `${Math.min(100, Math.round((event.registeredCount / event.capacity) * 100))}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => { e.stopPropagation(); handleRegister(event.id); }}
                            disabled={isReg || isFull || isRegistering}
                            className={`w-full py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                              isReg
                                ? 'bg-primary/15 text-primary border-primary/30 cursor-default'
                                : isFull
                                ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                                : 'bg-white/5 text-white/50 border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 disabled:opacity-60'
                            }`}
                          >
                            {isReg ? '✓ Registered' : isFull ? 'Event Full' : isRegistering ? 'Registering…' : 'Register'}
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}

                  {filteredSliderEvents.length === 0 && (
                    <div className="flex-shrink-0 w-52 h-52 rounded-xl border border-dashed border-white/10 flex items-center justify-center">
                      <div className="text-center">
                        <Calendar className="w-7 h-7 text-white/20 mx-auto mb-2" />
                        <p className="text-white/35 text-xs">
                          {eventsFilter === 'registered' ? 'No registered events' : eventsFilter === 'unregistered' ? 'All events registered!' : 'No upcoming events'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <MiniCalendar
            registeredEventDates={registeredEventDates}
            unregisteredEventDates={unregisteredEventDates}
            events={events}
            registrations={registrations}
          />

          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Profile</h3>
            <div className="space-y-2.5">
              {[
                ['Name', user?.name || 'N/A'],
                ['Roll No', user?.rollNo || 'N/A'],
                ['Programme', user?.programme || 'N/A'],
                ['Department', user?.department || 'N/A'],
                ['Year', user?.year ? `Year ${user.year}` : 'N/A'],
                ['Batch', user?.batch || 'N/A'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] text-white/30">{label}</p>
                  <p className="text-xs text-white/80 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </DashboardLayout>
  );
}
