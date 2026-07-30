'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Sparkles, Calendar, ArrowRight, Star, MapPin, Clock, Users, Zap,
  BookOpen, GraduationCap, CheckCircle2, XCircle, Radio, Hash, Building2, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { getRolePath, formatDate, formatTime } from '@/lib/utils';
import { getCurrentUser, apiCall } from '@/lib/api';
import { isEventLiveOrGrace, isEventUpcoming } from '@/lib/dateUtils';
import { useNowTick } from '@/lib/useNowTick';
import { mockEvents } from '@/lib/mockData';
import DashboardLayout from '@/components/DashboardLayout';
import EventCard from '@/components/EventCard';
import FlourishingTagline from '@/components/FlourishingTagline';
import Logo from '@/components/Logo';
import type { AuthPayload } from '@/types';
import toast from 'react-hot-toast';

export default function HomePage() {
  const [user, setUser] = useState<AuthPayload | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [volunteerStates, setVolunteerStates] = useState<Record<string, boolean>>({});
  const [registeringIds, setRegisteringIds] = useState<string[]>([]);
  const router = useRouter();
  useNowTick(); // re-render every 30s so isEventLiveOrGrace() flips to "live" without a manual refresh

  // Fetch user data and events from backend API
  useEffect(() => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      router.push("/login");
      setLoading(false); // ✅ FIX: Set loading false before return
      return;
    }
    
    const fetchData = async (showSpinner: boolean) => {
      // ✅ CRITICAL: Add timeout to prevent stuck loading — only for the
      // initial load; a silent background refresh (see visibilitychange
      // below) shouldn't flip the full-page spinner back on mid-flight.
      const timeoutId = showSpinner ? setTimeout(() => {
        console.log("⚠️ API call timeout - setting loading to false");
        setLoading(false);
      }, 10000) : undefined;
      try {
        // Fetch user data
        const userData = await getCurrentUser();
        
        // Transform backend user data with safe access
        const transformedUser: AuthPayload = {
          id: userData?.id || 'unknown',
          email: userData?.email || '',
          name: userData?.name || 'User',
          role: (userData?.role?.toLowerCase().replace(/_/g, '-') || 'student') as AuthPayload['role'],
          department: userData?.studentProfile?.department || 
                     userData?.instructorProfile?.department || 
                     userData?.adminProfile?.department || 
                     'IIT Bombay',
          rollNo: userData?.studentProfile?.rollNumber,
          empId: userData?.adminProfile?.employeeId || userData?.employeeId,
          year: userData?.studentProfile?.yearOfStudy,
          batch: userData?.studentProfile?.cohort,
          programme: userData?.studentProfile?.programme || 'Staff',
          iat: Date.now(),
        };
        
        setUser(transformedUser);
        localStorage.setItem('user', JSON.stringify(transformedUser));

        // Fetch real events from backend. activeOnly=false so past/completed
        // workshops are included too — without it, the backend excludes
        // anything whose endAt is in the past, so a course whose workshops
        // had all already happened (or a student's already-attended
        // workshops within an ongoing course) never showed up under
        // "Registered Courses" below. upcomingEvents/activeEvent further
        // down already do their own client-side date filtering, so
        // widening this fetch doesn't change what shows in those sections.
        console.log("🔄 Fetching events from backend...");
        const eventsResponse = await apiCall('/events?limit=200&activeOnly=false');
        console.log("📦 Events received:", eventsResponse);
        
        // Transform events to match frontend format
        const transformedEvents = eventsResponse.data.items.map((event: any) => {
          try {
            const startDate = new Date(event.startAt);
            return {
              id: event.id, // ✅ CRITICAL: Keep original database ID
              title: event.title || 'Untitled Event',
              description: event.description || '',
              date: startDate.toISOString().split('T')[0],
              time: startDate.toTimeString().slice(0, 5),
              startAt: event.startAt,
              endAt: event.endAt || null,
              courseId: event.courseId || null,
              courseModuleId: event.courseModuleId || null,
              batch: event.batch || null,
              // null/undefined = no cap specified (unlimited); 0 is a
              // deliberate "no volunteer slots" — the admin has no separate
              // on/off toggle for volunteer signup, so typing 0 into "Max
              // Volunteer Slots" is the only way to say that. The button
              // below must treat 0 as genuinely closed, not just "unlimited".
              volunteersNeeded: event.volunteersNeeded ?? null,
              allowVolunteerSignup: event.allowVolunteerSignup !== false,
              venue: event.venue || 'TBD',
              mode: event.meetLink ? 'Online' : 'In Classroom',
              capacity: event.capacity || 0,
              registeredCount: event._count?.registrations || 0,
              status: event.status?.toLowerCase() || 'draft', // Keep original status from backend
              organizer: event.createdBy?.name || 'Admin'
            };
          } catch (error) {
            console.error("❌ Error transforming event:", event, error);
            return {
              id: event.id || 'unknown',
              title: event.title || 'Untitled Event',
              description: event.description || '',
              date: '2026-05-04', // Fallback date
              time: '10:00', // Fallback time
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
        console.log("✅ Events loaded:", transformedEvents.length);
        console.log("🔍 Event IDs:", transformedEvents.map((e: any) => ({ id: e.id, title: e.title })));

        // 🔥 CRITICAL: Fetch user's registrations to show correct button states
        console.log("🔄 Fetching user registrations for home page...");
        const registrationsResponse = await apiCall('/registrations/me');
        console.log("📦 User registrations received:", registrationsResponse);
        
        const userRegistrations = registrationsResponse.data || [];
        setRegistrations(userRegistrations);
        console.log("✅ User registrations loaded:", userRegistrations.length);

        // Fetch courses to group registered workshops by course (student home view)
        try {
          const coursesResponse = await apiCall('/courses');
          setCourses(coursesResponse.data || coursesResponse.data?.items || []);
        } catch (e) {
          console.log("⚠️ Courses fetch failed (non-blocking)");
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to mock data only on the initial load — a failed silent
        // background refresh (showSpinner=false, see visibilitychange below)
        // must NOT replace already-loaded real events with mock placeholders.
        if (showSpinner) {
          console.log("⚠️ Using fallback mock data");
          const { mockEvents } = await import('@/lib/mockData');
          setEvents(mockEvents);
        }

        // Only redirect to login if it's an auth error
        if ((error as any)?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          router.push("/login");
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId); // Clear the timeout
        setLoading(false); // ✅ CRITICAL: Always set loading to false
      }
    };

    fetchData(true);

    // Browser back/forward (and some tab-switch cases) can restore this page
    // from Next.js's client-side router cache without re-running this effect,
    // so a workshop that went live/ended while the student was on its detail
    // page kept showing whatever was fetched on the ORIGINAL visit here. A
    // silent refetch (no spinner) whenever the page becomes visible again
    // keeps "Currently Active Event" current without disturbing anything else.
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(false); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
          <Logo className="w-12 h-12 rounded-2xl" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    // User is null but loading is false - redirect is happening or failed
    return (
      <div style={{ color: "white", textAlign: "center", marginTop: "100px" }}>
        Redirecting to login...
      </div>
    );
  }

  // Calculate active and upcoming events using each event's real startAt/endAt
  // (falls back to date+time only if startAt is missing), matching the logic
  // used everywhere else in the app (lib/dateUtils.ts) instead of a fixed 2-hour guess.
  const now = new Date();

  // Active event: currently happening (uses real endAt when available)
  const activeEvent = events.find(event => {
    const start = event.startAt || `${event.date}T${event.time}`;
    return isEventLiveOrGrace(start, event.endAt);
  });

  // Upcoming events: future events (starting after now)
  const upcomingEvents = events.filter(event => {
    const start = event.startAt || `${event.date}T${event.time}`;
    return isEventUpcoming(start);
  });

  // Check if user is registered for events
  const isRegisteredForEvent = (eventId: string) => {
    return registrations.some(reg => reg.eventId === eventId);
  };
  
  console.log("⏰ Strict time-based event filtering:");
  console.log("📅 Current time:", now.toISOString());
  console.log("🔴 Active event:", activeEvent?.title || "None");
  console.log("📋 Upcoming events:", upcomingEvents.length);
  console.log("📊 Total events loaded:", events.length);
  console.log("✅ User registrations:", registrations.length);
  
  const roleLabel = {
    student: 'Student',
    instructor: 'Instructor',
    admin: 'Administrator',
    volunteer: 'Volunteer',
    'associate-instructor': 'Associate Instructor',
  }[user.role];

  const dashboardPath = getRolePath(user.role);

  // ─── Student: registered courses grouped with per-workshop status ───
  const registeredEventIds = new Set(registrations.map((r: any) => r.eventId));
  const attendedEventIds = new Set(
    registrations.filter((r: any) => r.status === 'ATTENDED').map((r: any) => r.eventId)
  );
  const workshopStatus = (e: any): 'live' | 'upcoming' | 'completed' => {
    const start = e.startAt || `${e.date}T${e.time}`;
    if (isEventLiveOrGrace(start, e.endAt)) return 'live';
    if (isEventUpcoming(start)) return 'upcoming';
    return 'completed';
  };
  const courseCode = (c: any) => c.code || `FH-${String(c.id).slice(-5).toUpperCase()}`;
  const registeredCourses = courses
    .map((c: any) => {
      // Only workshops this student is actually registered for — every
      // workshop belonging to the course used to be listed (and shown as
      // "Not Attended") even ones the student never registered for, just
      // because the course itself had at least one registration.
      const workshops = events
        .filter((e: any) => e.courseId === c.id && registeredEventIds.has(e.id))
        .map((e: any) => ({
          ...e,
          wStatus: workshopStatus(e),
          registered: true,
          attended: attendedEventIds.has(e.id),
          pending: false,
        }));

      if (workshops.length === 0) return { ...c, workshops, registeredCount: 0 };

      // Compulsory bundle courses: the course template (CourseModule) may
      // list workshops that haven't been scheduled yet. A student already
      // in this course's bundle is in for those too — shown here as
      // "Pending Schedule" using the template's title, sourced from
      // c.modules (now included by the /courses API) rather than needing a
      // real Event/registration row, since there's no eventId to attach one
      // to until an admin actually schedules it.
      const studentBatch = workshops.find((w: any) => w.batch)?.batch ?? null;
      const relevantEvents = events.filter((e: any) => e.courseId === c.id && (e.batch === studentBatch || !e.batch));
      const scheduledModuleIds = new Set(
        relevantEvents.filter((e: any) => e.courseModuleId).map((e: any) => e.courseModuleId)
      );
      // Events created outside the module-based flow (e.g. a plain bulk
      // schedule import) never get a courseModuleId, so a module can only be
      // "already scheduled" via that link when one was actually set — fall
      // back to matching the event's title against the module's title,
      // otherwise a module whose event skipped that link shows up as a
      // duplicate "Pending Schedule" entry next to the real, already-
      // registered one.
      const scheduledTitles = new Set(
        relevantEvents.map((e: any) => (e.title || '').trim().toLowerCase()).filter(Boolean)
      );
      // A module whose Event already exists for this student's batch but
      // isn't in `scheduledModuleIds`'s complement (i.e. the student isn't
      // registered for it yet) used to vanish entirely here - it failed the
      // `workshops` registration check AND got excluded from
      // `pendingWorkshops` by the scheduled-module check above, with nothing
      // to replace it. Surface the real matched event (real date/venue)
      // instead of the bare "Pending Schedule" placeholder whenever one
      // exists, so registering for ≥1 workshop is enough to see the rest of
      // the bundle as it gets scheduled.
      const relevantEventByModuleId = new Map(
        relevantEvents.filter((e: any) => e.courseModuleId).map((e: any) => [e.courseModuleId, e])
      );
      const pendingWorkshops = (c.modules || [])
        .filter((m: any) => !scheduledModuleIds.has(m.id) && !scheduledTitles.has((m.title || '').trim().toLowerCase()))
        .map((m: any) => {
          const scheduledEvent = relevantEventByModuleId.get(m.id);
          if (scheduledEvent) {
            return {
              ...scheduledEvent,
              id: scheduledEvent.id,
              title: scheduledEvent.title || m.title,
              wStatus: workshopStatus(scheduledEvent),
              registered: false,
              attended: false,
              pending: false,
            };
          }
          return {
            id: `pending-${m.id}`,
            title: m.title,
            wStatus: 'pending',
            registered: false,
            attended: false,
            pending: true,
          };
        });

      return { ...c, workshops: [...workshops, ...pendingWorkshops], registeredCount: workshops.length };
    })
    .filter((c: any) => c.registeredCount > 0);

  const handleRegister = async (eventId: string, eventTitle: string) => {
    if (registeringIds.includes(eventId)) return; // already in flight — ignore rapid double-clicks
    setRegisteringIds(prev => [...prev, eventId]);
    try {
      console.log("🔄 REGISTERING EVENT ID:", eventId);
      console.log("📝 Event Title:", eventTitle);

      const response = await apiCall('/registrations', {
        method: 'POST',
        body: JSON.stringify({
          eventId: eventId,
          asVolunteer: false
        })
      });

      console.log("✅ Registration successful:", response);
      toast.success(`Successfully registered for ${eventTitle}!`);

      // 🔥 CRITICAL: Refresh registrations to update UI
      const registrationsResponse = await apiCall('/registrations/me');
      setRegistrations(registrationsResponse.data || []);

    } catch (error: any) {
      console.error("❌ Registration failed:", error);
      if (error.message?.includes('already registered')) {
        toast.error('You are already registered for this event');
      } else if (error.message?.includes('capacity is full')) {
        toast.error('Event is full - registration closed');
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setRegisteringIds(prev => prev.filter(id => id !== eventId));
    }
  };

  const handleVolunteer = async (eventId: string, eventTitle: string) => {
    if (registeringIds.includes(eventId)) return; // already in flight — ignore rapid double-clicks

    const isCurrentlyVolunteered = volunteerStates[eventId];
    if (isCurrentlyVolunteered) {
      // TODO: Implement unregister API if needed
      toast('Volunteer unregistration not implemented yet', { icon: 'ℹ️' });
      return;
    }

    setRegisteringIds(prev => [...prev, eventId]);
    try {
      console.log("🔄 VOLUNTEERING FOR EVENT ID:", eventId);

      const response = await apiCall('/registrations', {
        method: 'POST',
        body: JSON.stringify({
          eventId: eventId,
          asVolunteer: true
        })
      });

      console.log("✅ Volunteer registration successful:", response);
      setVolunteerStates((prev) => ({ ...prev, [eventId]: true }));
      toast.success(`Registered as volunteer for ${eventTitle}!`);

    } catch (error: any) {
      console.error("❌ Volunteer registration failed:", error);
      if (error.message?.includes('already registered')) {
        toast.error('You are already registered for this event');
      } else {
        // Surface the backend's actual reason (seats full, closed, wrong
        // batch, etc.) instead of a generic message that hides why it
        // failed — the previous fallback here made a real, fixable cause
        // (e.g. 0 volunteer slots configured) look like a random error.
        toast.error(error.message || 'Volunteer registration failed. Please try again.');
      }
    } finally {
      setRegisteringIds(prev => prev.filter(id => id !== eventId));
    }
  };

  return (
    <DashboardLayout user={user}>
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-8 md:p-10 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-accent/12 pointer-events-none" />
          <motion.div
            className="absolute -top-24 -right-16 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-20 -left-10 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
          />
          <div className="relative z-10 flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/50 text-[11px] font-medium tracking-wide">
                  <Sparkles className="w-3 h-3 text-primary" />
                  {user.role === 'instructor'
                    ? (() => {
                        const date = new Date();
                        const month = date.toLocaleDateString('en-US', { month: 'short' });
                        const day = date.getDate();
                        const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
                        const year = date.getFullYear();
                        return `${month} ${day}, ${weekday}, ${year}`;
                      })()
                    : format(new Date(), 'EEEE, MMMM d, yyyy')
                  }
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
                Welcome back, <span className="gradient-text">{user.name.split(' ')[0]}</span> <span className="inline-block animate-[float_3s_ease-in-out_infinite]">👋</span>
              </h1>
              <p className="text-white/50 text-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {roleLabel}
                {user.department &&
                 user.role === 'instructor' &&
                 (user.department === 'Humanities and Social Sciences' ||
                  user.department === 'Humanities & Social Sciences')
                  ? ''
                  : user.department ? ` · ${user.department}` : ' · IIT Bombay'}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(108,99,255,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                router.push(dashboardPath);
              }}
              className="btn-primary px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Go to Dashboard <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* ─── Student: Portfolio & Registered Courses ─── */}
        {user.role === 'student' && (
          <>
            {/* Portfolio */}
            <div>
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Portfolio</h2>
              <motion.div
                whileHover={{ y: -2 }}
                className="glass-card rounded-2xl p-6 relative overflow-hidden transition-shadow hover:shadow-card-hover"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[#ffffff] text-2xl sm:text-3xl font-bold shadow-glow-sm ring-2 ring-white/10">
                        {user.name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 border-2 border-[rgb(var(--color-card))] flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </span>
                    </div>
                    <div className="min-w-0 sm:hidden">
                      <p className="text-lg font-bold text-white truncate">{user.name}</p>
                      <p className="text-xs text-white/40 mt-0.5 truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="hidden sm:block text-lg font-bold text-white truncate">{user.name}</p>
                    <p className="hidden sm:block text-xs text-white/40 mt-0.5">{user.email}</p>
                    <div className="flex flex-wrap gap-2 sm:mt-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:border-primary/30 transition-colors">
                        <Hash className="w-3 h-3 text-primary" /> {user.rollNo || '—'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:border-primary/30 transition-colors">
                        <GraduationCap className="w-3 h-3 text-primary" />
                        {user.programme || '—'}{user.year ? ` · Yr ${user.year}` : ''}
                      </span>
                      {user.department && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:border-primary/30 transition-colors">
                          <Building2 className="w-3 h-3 text-primary" /> {user.department}
                        </span>
                      )}
                      {user.batch && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-xs text-accent font-mono">
                          {user.batch}
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href="/student/profile"
                    className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/25 text-xs font-semibold hover:bg-primary/20 hover:border-primary/40 transition-all w-full sm:w-auto"
                  >
                    View Profile <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* Registered Courses */}
            <div>
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Registered Courses</h2>
              {registeredCourses.length === 0 ? (
                <div className="glass-card rounded-2xl p-6 text-center text-white/40 text-sm">
                  No registered courses yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {registeredCourses.map((c: any) => {
                    const totalW = c.workshops.length;
                    const attendedW = c.workshops.filter((w: any) => w.attended).length;
                    const pct = totalW > 0 ? Math.round((attendedW / totalW) * 100) : 0;
                    return (
                    <motion.div key={c.id} whileHover={{ y: -2 }} className="glass-card rounded-2xl p-6 transition-shadow hover:shadow-card-hover">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-white font-semibold">{c.name}</p>
                            <p className="text-white/40 text-xs font-mono">{courseCode(c)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:flex items-center gap-2 w-32">
                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                              />
                            </div>
                            <span className="text-[11px] text-white/40 font-medium tabular-nums shrink-0">{pct}%</span>
                          </div>
                          <span className="text-xs text-white/50 shrink-0">
                            {totalW} workshop{totalW !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {c.workshops.map((w: any, i: number) => (
                          <div key={w.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 hover:bg-white/[0.05] hover:border-white/15 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${
                                w.attended ? 'bg-emerald-500/20 text-emerald-400' : w.pending ? 'bg-white/10 text-white/40' : 'bg-primary/15 text-primary'
                              }`}>{i + 1}</span>
                              <div className="min-w-0">
                                <span className="text-white/80 text-sm truncate block">{w.title}</span>
                                {!w.pending && w.date && (
                                  <span className="text-white/35 text-[11px] flex items-center gap-1 mt-0.5">
                                    <Calendar className="w-2.5 h-2.5 shrink-0" />
                                    {formatDate(w.date)} · {formatTime(w.time)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {w.pending ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/50 border border-white/15">
                                  Pending Schedule
                                </span>
                              ) : w.wStatus === 'live' ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <Radio className="w-3 h-3" /> Live
                                </span>
                              ) : w.wStatus === 'upcoming' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                  Upcoming
                                </span>
                              ) : (
                                <>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/50 border border-white/15">
                                    Completed
                                  </span>
                                  {w.attended ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3" /> Attended
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                                      <XCircle className="w-3 h-3" /> Not Attended
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Active Event */}
        {activeEvent && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Currently Active Event</h2>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-3xl overflow-hidden border border-emerald-500/30"
              style={{ background: 'rgb(var(--color-card))' }}
            >
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ boxShadow: ['0 0 30px rgba(16,185,129,0.10) inset', '0 0 55px rgba(16,185,129,0.22) inset', '0 0 30px rgba(16,185,129,0.10) inset'] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5 pointer-events-none" />
              <div className="absolute -top-10 -right-10 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 p-8">
                {/* flex-wrap alone doesn't reliably wrap this on mobile — the
                    left block's flex-1 (flex-basis: 0) makes the browser's
                    wrap-threshold calculation ignore its real content width,
                    so the button column stayed on the same line as the badge
                    row and visually overlapped it. Force a real stack below
                    sm instead of relying on wrap. */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                        <motion.span
                          className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ repeat: Infinity, duration: 1.4 }}
                        />
                        Live Now
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        activeEvent.mode === 'Online'
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                      }`}>
                        {activeEvent.mode}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{activeEvent.title}</h3>
                    <p className="text-white/50 text-sm mb-4 max-w-xl">{activeEvent.description}</p>
                    <div className="flex flex-wrap gap-2 text-sm text-white/60">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        {formatDate(activeEvent.date)}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {formatTime(activeEvent.time)}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
                        <MapPin className="w-3.5 h-3.5 text-accent" />
                        {activeEvent.venue}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        {activeEvent.registeredCount} / {activeEvent.capacity}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 shrink-0">
                    {(user.role === 'student') && (
                      <>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleRegister(activeEvent.id, activeEvent.title)}
                          disabled={registeringIds.includes(activeEvent.id)}
                          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                            isRegisteredForEvent(activeEvent.id)
                              ? 'bg-primary/20 text-primary border border-primary/30'
                              : 'btn-primary'
                          }`}
                        >
                          {registeringIds.includes(activeEvent.id) ? 'Registering…' : isRegisteredForEvent(activeEvent.id) ? 'Registered ✓' : 'Register Now'}
                        </motion.button>
                        {/* This card had no way at all to open the live session page for
                            students — only a Register button, which does nothing once
                            already registered. Added so a live/in-grace workshop is
                            actually reachable from the home page. */}
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => router.push(`/student/events/${activeEvent.id}`)}
                          className="px-6 py-3 rounded-xl font-semibold text-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                        >
                          Go to Live Session
                        </motion.button>
                      </>
                    )}
                    {user.role === 'volunteer' && (
                      activeEvent.allowVolunteerSignup === false || activeEvent.volunteersNeeded === 0 ? (
                        <div
                          className="px-6 py-3 rounded-xl font-semibold text-sm border border-white/10 bg-white/[0.03] text-white/30 cursor-not-allowed text-center"
                          title="This event has no volunteer slots open"
                        >
                          No Volunteer Slots
                        </div>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleVolunteer(activeEvent.id, activeEvent.title)}
                          disabled={registeringIds.includes(activeEvent.id)}
                          className={`px-6 py-3 rounded-xl font-semibold text-sm border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                            volunteerStates[activeEvent.id]
                              ? 'bg-accent/20 text-accent border-accent/30'
                              : 'bg-white/5 text-white/70 border-white/15 hover:bg-accent/10 hover:text-accent hover:border-accent/30'
                          }`}
                        >
                          {registeringIds.includes(activeEvent.id) ? 'Registering…' : volunteerStates[activeEvent.id] ? '✓ Volunteered' : 'Register as Volunteer'}
                        </motion.button>
                      )
                    )}
                    {(user.role === 'instructor' || user.role === 'associate-instructor') && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => router.push(dashboardPath)}
                        className="btn-primary px-6 py-3 rounded-xl font-semibold text-sm"
                      >
                        View Details
                      </motion.button>
                    )}
                    {user.role === 'admin' && (
                      <Link href="/admin#events">
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          className="btn-primary px-6 py-3 rounded-xl font-semibold text-sm"
                        >
                          Manage Event
                        </motion.button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Flourishing Hub Tagline */}
        <FlourishingTagline />

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Upcoming Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {upcomingEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <EventCard
                    event={event}
                    onRegister={user.role === 'student' ? (eventId) => handleRegister(eventId, event.title) : undefined}
                    isRegistered={isRegisteredForEvent(event.id)}
                    showVolunteerButton={user.role === 'volunteer'}
                    onVolunteer={user.role === 'volunteer' ? (eventId) => handleVolunteer(eventId, event.title) : undefined}
                    isVolunteered={volunteerStates[event.id]}
                    hideActions={user.role === 'instructor' || user.role === 'associate-instructor'}
                    onClick={
                      user.role === 'instructor' || user.role === 'associate-instructor'
                        ? () => {
                            toast('Workshop details page coming soon!', { icon: '📋' });
                          }
                        : undefined
                    }
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div>
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(user.role === 'admin' ? [
              { label: 'Admin Panel', href: '/admin', icon: Sparkles, color: 'primary' },
              { label: 'Events', href: '/admin#events', icon: Calendar, color: 'teal' },
              { label: 'Members', href: '/admin#members', icon: Users, color: 'yellow' },
              { label: 'Courses', href: '/admin#courses', icon: Star, color: 'purple' },
            ] : [
              { label: 'My Dashboard', href: dashboardPath, icon: Sparkles, color: 'primary' },
              { label: 'All Events', href: `${dashboardPath}#events`, icon: Calendar, color: 'teal' },
              { label: 'Schedule', href: `${dashboardPath}#schedule`, icon: Clock, color: 'yellow' },
              { label: 'History', href: `${dashboardPath}#history`, icon: Star, color: 'purple' },
            ]).map(({ label, href, icon: Icon, color }, i) => (
              <Link key={label} href={href}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="glass-card rounded-2xl p-4 text-center cursor-pointer group relative overflow-hidden transition-all hover:border-primary/30 hover:shadow-card-hover"
                >
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${
                    color === 'primary' ? 'from-primary/10 to-transparent' :
                    color === 'teal' ? 'from-accent/10 to-transparent' :
                    color === 'yellow' ? 'from-yellow-500/10 to-transparent' :
                    'from-violet-500/10 to-transparent'
                  }`} />
                  <div className={`relative w-11 h-11 rounded-xl mx-auto mb-3 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                    color === 'primary' ? 'bg-primary/15 text-primary' :
                    color === 'teal' ? 'bg-accent/15 text-accent' :
                    color === 'yellow' ? 'bg-yellow-500/15 text-yellow-400' :
                    'bg-violet-500/15 text-violet-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="relative text-xs font-semibold text-white/70 group-hover:text-white transition-colors">{label}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
