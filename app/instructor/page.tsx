'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Video, Users, Clock, CheckCircle, Wifi, WifiOff, MapPin,
  Calendar, ExternalLink, Bell, User, Filter, Star, MessageSquare, Zap,
  UserCheck, ShieldCheck, ShieldX, RefreshCw, ChevronDown, BookOpen
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import StatCard from '@/components/StatCard';
import MiniCalendar from '@/components/MiniCalendar';
import { apiCall } from '@/lib/api';
import { formatTime } from '@/lib/utils';
import { toLocalDateKey, isEventLive } from '@/lib/dateUtils';
import { useNowTick } from '@/lib/useNowTick';
import toast from 'react-hot-toast';

// Custom date format for instructor: "May 6, Wed, 2026"
function formatInstructorDate(dateStr: string | Date): string {
  const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const year = date.getFullYear();
  return `${month} ${day}, ${weekday}, ${year}`;
}

type WorkshopFilter = 'all' | 'open' | 'course';
type CourseFilter = 'all' | 'mentorship' | 'leadership' | 'wellness';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface Session {
  id: string;
  title: string;
  eventTitle: string;
  courseId?: string | null;
  venue: string;
  startAt: string;
  endAt: string;
  mode: 'online' | 'in-classroom';
  meetLink?: string;
}

interface InstructorData {
  basicInfo: {
    name: string;
    designation: string;
    department: string;
    employeeId?: string;
    profilePicture?: string;
  };
  upcomingSessions: Session[];
  pastSessions: Session[];
  calendarData: Array<{
    id: string;
    title: string;
    startAt: string;
  }>;
  studentsImpacted?: number;
}

function SessionCard({ session }: { session: Session }) {
  const startDate = new Date(session.startAt);
  const endDate = new Date(session.endAt);
  const live = isEventLive(session.startAt, session.endAt);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`glass-card rounded-2xl p-5 ${live ? 'border-emerald-500/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white leading-tight mb-1">
            {session.eventTitle}
          </h3>
          <p className="text-xs text-white/50">{session.title}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {live && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            session.mode === 'online'
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              : 'bg-teal-500/15 text-teal-400 border-teal-500/30'
          }`}>
            {session.mode === 'online' ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            {session.mode === 'online' ? 'Online' : 'In-Classroom'}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Calendar className="w-3.5 h-3.5 text-primary/70" />
          <span>{formatInstructorDate(startDate)}</span>
          <Clock className="w-3.5 h-3.5 text-primary/70 ml-1" />
          <span>{formatTime(startDate)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <MapPin className="w-3.5 h-3.5 text-accent/70" />
          <span className="truncate">{session.venue}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {session.mode === 'online' && session.meetLink && (
          <motion.a
            href={session.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.95 }}
            className="flex-1 btn-primary py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Meet Link
          </motion.a>
        )}
        {session.mode === 'in-classroom' && (
          <div className="flex-1 text-center py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60">
            In-person session
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PastSessionCard({ session }: { session: Session }) {
  const startDate = new Date(session.startAt);
  
  return (
    <div className="glass-card rounded-xl p-4 grid grid-cols-[80px_1fr] sm:grid-cols-[120px_1fr_auto] gap-4 items-center">
      {/* Date Column - First */}
      <div className="text-center">
        <div className="text-lg font-bold text-white">{startDate.getDate()}</div>
        <div className="text-xs text-white/50">{startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
        <div className="text-[10px] text-white/30 mt-1">{startDate.toLocaleDateString('en-US', { weekday: 'short' })}</div>
      </div>
      
      {/* Workshop Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white mb-0.5 truncate">{session.eventTitle}</h4>
            <p className="text-xs text-white/40 truncate">{session.title}</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
            session.mode === 'online'
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              : 'bg-teal-500/15 text-teal-400 border-teal-500/30'
          }`}>
            {session.mode === 'online' ? 'Online' : 'In-Classroom'}
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-white/50">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>{formatTime(startDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{session.venue}</span>
          </div>
        </div>
      </div>
      
      {/* Feedback Rating */}
      <div className="text-center col-span-2 sm:col-span-1">
        <div className="flex items-center justify-center sm:justify-start gap-1 text-yellow-400 mb-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg key={star} className="w-3 h-3 fill-current" viewBox="0 0 20 20">
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
          ))}
        </div>
        <p className="text-[10px] text-white/30">Feedback</p>
      </div>
    </div>
  );
}

export default function InstructorDashboard() {
  useNowTick();
  const [data, setData] = useState<InstructorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'workshops' | 'attendance' | 'feedback'>('workshops');
  const [workshopFilter, setWorkshopFilter] = useState<WorkshopFilter>('all');
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all');
  const [pastWorkshopFilter, setPastWorkshopFilter] = useState<WorkshopFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' });

  // ── Attendance / check-in verification (same /event-operations
  // endpoints already used on the Associate Instructor dashboard — the
  // backend authorizes both INSTRUCTOR and ASSOCIATE_INSTRUCTOR for these,
  // this page just never had the UI for it) ──
  const [assignedEvents, setAssignedEvents] = useState<any[]>([]);
  const [loadingAssignedEvents, setLoadingAssignedEvents] = useState(true);
  const [selectedAttendanceEventId, setSelectedAttendanceEventId] = useState<string | null>(null);
  const [selectedCourseGroup, setSelectedCourseGroup] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchAssignedEvents = async (silent = false) => {
    if (!silent) setLoadingAssignedEvents(true);
    try {
      const response = await apiCall('/event-operations/my-assigned-events');
      setAssignedEvents(response.data || []);
    } catch {
      if (!silent) toast.error('Could not load assigned events');
    } finally {
      setLoadingAssignedEvents(false);
    }
  };

  const fetchCheckIns = async (eventId: string) => {
    setLoadingCheckIns(true);
    try {
      const response = await apiCall('/event-operations/' + eventId + '/check-ins');
      setCheckIns(response.data || []);
    } catch {
      toast.error('Could not load check-ins');
    } finally {
      setLoadingCheckIns(false);
    }
  };

  useEffect(() => {
    fetchAssignedEvents();
    const interval = setInterval(() => fetchAssignedEvents(true), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedAttendanceEventId) { setCheckIns([]); return; }
    fetchCheckIns(selectedAttendanceEventId);
    const interval = setInterval(() => fetchCheckIns(selectedAttendanceEventId), 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAttendanceEventId]);

  const handleVerify = async (checkInId: string, status: 'VERIFIED' | 'REJECTED', note = '') => {
    setVerifyingId(checkInId);
    try {
      await apiCall('/event-operations/check-ins/' + checkInId, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      });
      toast.success(status === 'VERIFIED' ? 'Attendance verified' : 'Marked absent');
      if (selectedAttendanceEventId) await fetchCheckIns(selectedAttendanceEventId);
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!selectedAttendanceEventId) return;
    setVerifyingId('__all__');
    try {
      await apiCall('/event-operations/' + selectedAttendanceEventId + '/check-ins/verify-all', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('All pending check-ins verified');
      await fetchCheckIns(selectedAttendanceEventId);
    } catch {
      toast.error('Bulk verify failed. Please try again.');
    } finally {
      setVerifyingId(null);
    }
  };

  const attendanceCourseGroups: { label: string; events: any[] }[] = (() => {
    const groups: Record<string, any[]> = {};
    for (const ev of assignedEvents) {
      const key = ev.course?.name || 'Open Workshops';
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    }
    return Object.entries(groups).map(([label, events]) => ({ label, events }));
  })();

  useEffect(() => {
    if (attendanceCourseGroups.length === 1 && !selectedCourseGroup) {
      setSelectedCourseGroup(attendanceCourseGroups[0].label);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedEvents.length]);

  const eventsInSelectedCourseGroup = selectedCourseGroup
    ? (attendanceCourseGroups.find((g) => g.label === selectedCourseGroup)?.events ?? [])
    : [];
  const selectedAttendanceEvent = assignedEvents.find((e) => e.id === selectedAttendanceEventId);
  const verifiedCount = checkIns.filter((c) => c.status === 'VERIFIED').length;
  const pendingCount = checkIns.filter((c) => c.status === 'PENDING').length;

  // Sidebar links use hash navigation (/instructor#attendance etc.) — sync
  // activeTab to the hash so those links (and a direct/bookmarked URL)
  // actually land on the right tab instead of always defaulting to Workshops.
  useEffect(() => {
    const validTabs = ['workshops', 'attendance', 'feedback'] as const;
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'sessions' || hash === 'schedule') { setActiveTab('workshops'); return; }
      if ((validTabs as readonly string[]).includes(hash)) setActiveTab(hash as typeof validTabs[number]);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login first');
      window.location.href = '/login';
      return;
    }

    // Main dashboard fetch — its own try/catch so a feedback-only failure
    // never gets mislabeled as "Failed to load dashboard"
    try {
      const result = await apiCall('/instructor/dashboard');
      setData(result.data);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load dashboard');
      setLoading(false);
      return;
    }
    setLoading(false);

    // Feedback fetch — separate try/catch; failure here shouldn't block or
    // mislabel the (already successfully loaded) main dashboard
    try {
      const fbResult = await apiCall('/instructor/feedback');
      setFeedbackData(fbResult.data || []);
    } catch (error) {
      console.error('Feedback fetch error:', error);
      toast.error('Failed to load feedback data');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-white/50">Failed to load dashboard data</p>
        </div>
      </DashboardLayout>
    );
  }

  const todaySessions = data.upcomingSessions.filter(session => {
    const sessionDate = new Date(session.startAt);
    const today = new Date();
    return sessionDate.toDateString() === today.toDateString();
  });

  // Students Impacted — real distinct-attendee count from backend (see dashboard.service.js).
  // Falls back to a plain "—" rather than a fabricated number if the backend hasn't provided it yet.
  const studentsImpacted = data.studentsImpacted;
  const studentsImpactedDisplay = studentsImpacted != null ? studentsImpacted : '—';

  // "Sessions conducted" = past sessions only (upcoming ones haven't happened yet),
  // averaged over the months actually elapsed since the earliest one — not a fixed /3.
  const avgSessionsPerMonth = (() => {
    const conducted = data.pastSessions;
    if (conducted.length === 0) return 0;
    const earliest = Math.min(...conducted.map(s => new Date(s.startAt).getTime()));
    const monthsElapsed = Math.max(1, (Date.now() - earliest) / (1000 * 60 * 60 * 24 * 30));
    return Math.round(conducted.length / monthsElapsed);
  })();

  // Filter workshops based on type
  const getFilteredWorkshops = () => {
    let filtered = data.upcomingSessions;
    
    // Apply workshop type filter — courseId is the authoritative signal for
    // "belongs to a course" (same convention as app/admin/page.tsx's
    // eventStatusFilter), not a substring match on the title.
    if (workshopFilter === 'open') {
      filtered = filtered.filter(s => !s.courseId);
    } else if (workshopFilter === 'course') {
      filtered = filtered.filter(s => !!s.courseId);

      // Apply course sub-filter
      if (courseFilter !== 'all') {
        filtered = filtered.filter(s =>
          s.eventTitle.toLowerCase().includes(courseFilter)
        );
      }
    }
    
    return filtered;
  };

  const filteredWorkshops = getFilteredWorkshops();

  // Sessions currently in their live window — upcomingSessions now includes
  // these too (backend switched from startAt>=now to endAt>=now), so split
  // them out here rather than double-fetching.
  const liveSessionsNow = filteredWorkshops.filter((s) => isEventLive(s.startAt, s.endAt));
  const strictlyUpcoming = filteredWorkshops.filter((s) => !isEventLive(s.startAt, s.endAt));

  // Filter past workshops
  const getFilteredPastWorkshops = () => {
    let filtered = data.pastSessions;
    
    // Apply workshop type filter
    if (pastWorkshopFilter === 'open') {
      filtered = filtered.filter(s => !s.courseId);
    } else if (pastWorkshopFilter === 'course') {
      filtered = filtered.filter(s => !!s.courseId);
    }
    
    // Apply date range filter
    if (dateRange.startDate) {
      filtered = filtered.filter(s => new Date(s.startAt) >= new Date(dateRange.startDate));
    }
    if (dateRange.endDate) {
      filtered = filtered.filter(s => new Date(s.startAt) <= new Date(dateRange.endDate));
    }
    
    return filtered;
  };

  const filteredPastWorkshops = getFilteredPastWorkshops();

  return (
    <DashboardLayout>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -8 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">
            <span className="gradient-text">{data.basicInfo.name}</span>
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {data.basicInfo.department && 
             data.basicInfo.department !== 'Humanities and Social Sciences' && 
             data.basicInfo.department !== 'Humanities & Social Sciences' && 
             data.basicInfo.department}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Bell className="w-4 h-4 text-white/60" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <User className="w-4 h-4 text-white/60" />
          </motion.button>
        </div>
      </motion.div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('workshops')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
            activeTab === 'workshops'
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
          }`}
        >
          <Video className="w-4 h-4 inline mr-1.5" />Workshops
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
            activeTab === 'attendance'
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
          }`}
        >
          <UserCheck className="w-4 h-4 inline mr-1.5" />Attendance
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-1.5 ${
            activeTab === 'feedback'
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
          }`}
        >
          <MessageSquare className="w-4 h-4" />Feedback
          {feedbackData.reduce((s: number, e: any) => s + (e.totalFeedback || 0), 0) > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/30 text-primary text-[10px]">
              {feedbackData.reduce((s: number, e: any) => s + (e.totalFeedback || 0), 0)}
            </span>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Upcoming Workshops" 
          value={data.upcomingSessions.length} 
          icon={Video} 
          color="purple" 
        />
        <StatCard 
          title="Completed Workshops" 
          value={data.pastSessions.length} 
          icon={CheckCircle} 
          color="teal" 
        />
        <StatCard 
          title="Today's Sessions" 
          value={todaySessions.length} 
          icon={Clock} 
          color="yellow" 
        />
        <StatCard
          title="Students Impacted"
          value={studentsImpactedDisplay}
          icon={Users}
          color="blue"
        />
      </div>

      {/* Analytics Section */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Analytics Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Users Impacted */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Total Users Impacted</p>
            <p className="text-2xl font-bold text-white">{studentsImpactedDisplay}</p>
            <p className="text-xs text-white/30">Across all workshops</p>
          </div>
          
          {/* Total Past Workshops */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Total Past Workshops</p>
            <p className="text-2xl font-bold text-white">{data.pastSessions.length}</p>
            <p className="text-xs text-white/30">Successfully completed</p>
          </div>
          
          {/* Active Workshops */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Active Workshops</p>
            <p className="text-2xl font-bold text-white">{todaySessions.length}</p>
            <p className="text-xs text-white/30">Happening today</p>
          </div>
          
          {/* Session Load */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Session Load</p>
            <p className="text-2xl font-bold text-white">{data.upcomingSessions.length + data.pastSessions.length}</p>
            <p className="text-xs text-white/30">Total sessions assigned</p>
          </div>
          
          {/* This Week */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">This Week</p>
            <p className="text-2xl font-bold text-white">
              {data.upcomingSessions.filter(s => {
                const sessionDate = new Date(s.startAt);
                const weekFromNow = new Date();
                weekFromNow.setDate(weekFromNow.getDate() + 7);
                return sessionDate <= weekFromNow;
              }).length}
            </p>
            <p className="text-xs text-white/30">Upcoming sessions</p>
          </div>
          
          {/* Average per Month */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Avg per Month</p>
            <p className="text-2xl font-bold text-white">
              {avgSessionsPerMonth}
            </p>
            <p className="text-xs text-white/30">Sessions conducted</p>
          </div>
        </div>
      </div>

      {/* Attendance Tab Content */}
      {activeTab === 'attendance' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-semibold text-white">Live Workshop Attendance</h3>
            {selectedAttendanceEventId && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">Auto-refreshes every 15s</span>
                <button
                  onClick={() => selectedAttendanceEventId && fetchCheckIns(selectedAttendanceEventId)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-all text-xs"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            )}
          </div>

          {loadingAssignedEvents ? (
            <div className="flex items-center gap-2 text-white/50 text-sm py-6 justify-center">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading events...
            </div>
          ) : assignedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-white/50 text-sm">No assigned workshops</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendanceCourseGroups.length > 1 && (
                <div>
                  <p className="text-xs text-white/40 font-medium mb-2 uppercase tracking-wider">Select Course</p>
                  <div className="flex flex-wrap gap-2">
                    {attendanceCourseGroups.map((group) => (
                      <button
                        key={group.label}
                        onClick={() => { setSelectedCourseGroup(group.label); setSelectedAttendanceEventId(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          selectedCourseGroup === group.label
                            ? 'bg-primary/20 border-primary/50 text-primary'
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
                        }`}
                      >
                        <BookOpen className="w-3 h-3" />
                        {group.label}
                        <span className="ml-0.5 opacity-60">({group.events.length})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedCourseGroup && (
                <div>
                  <p className="text-xs text-white/40 font-medium mb-2 uppercase tracking-wider">Select Workshop</p>
                  <div className="relative max-w-sm">
                    <select
                      value={selectedAttendanceEventId || ''}
                      onChange={(e) => setSelectedAttendanceEventId(e.target.value || null)}
                      className="filter-select w-full appearance-none px-4 py-2.5 pr-9 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50 cursor-pointer"
                    >
                      <option value="">— Select a workshop —</option>
                      {eventsInSelectedCourseGroup.map((ev: any) => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  </div>
                </div>
              )}

              {selectedAttendanceEvent && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/60">
                  <div className="flex flex-wrap gap-3">
                    <span className="text-white/80 font-medium">{selectedAttendanceEvent.title}</span>
                    {selectedAttendanceEvent.course?.name && (
                      <span>Course: <span className="text-white/80">{selectedAttendanceEvent.course.name}</span></span>
                    )}
                    {selectedAttendanceEvent.venue && (
                      <span>Venue: <span className="text-white/80">{selectedAttendanceEvent.venue}</span></span>
                    )}
                  </div>
                  <Link
                    href={`/instructor/events/${selectedAttendanceEventId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all font-semibold shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Live Event Page
                  </Link>
                </div>
              )}
            </div>
          )}

          {!loadingAssignedEvents && selectedAttendanceEventId && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    {verifiedCount} Verified
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                    {pendingCount} Pending
                  </span>
                </div>
                {pendingCount > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleVerifyAll}
                    disabled={verifyingId === '__all__'}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all text-xs font-semibold disabled:opacity-60"
                  >
                    {verifyingId === '__all__' ? (
                      <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    Verify All Pending
                  </motion.button>
                )}
              </div>

              {loadingCheckIns ? (
                <div className="flex items-center justify-center py-8 gap-2 text-white/40 text-sm">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading check-ins...
                </div>
              ) : checkIns.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">
                  No check-ins yet — students will appear here once they record attendance
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="text-left px-4 py-3 text-white/50 font-medium text-xs">Name</th>
                        <th className="text-left px-4 py-3 text-white/50 font-medium text-xs">Roll No</th>
                        <th className="text-left px-4 py-3 text-white/50 font-medium text-xs">Batch</th>
                        <th className="text-left px-4 py-3 text-white/50 font-medium text-xs">Check-in Time</th>
                        <th className="text-left px-4 py-3 text-white/50 font-medium text-xs">Status</th>
                        <th className="text-left px-4 py-3 text-white/50 font-medium text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkIns.map((ci: any) => {
                        const isActing = verifyingId === ci.id;
                        const checkinTime = (ci.checkedInAt || ci.createdAt)
                          ? new Date(ci.checkedInAt || ci.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—';
                        return (
                          <tr key={ci.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-white font-medium">{ci.user?.name || '—'}</td>
                            <td className="px-4 py-3 text-white/60 text-xs">{ci.user?.studentProfile?.rollNumber || '—'}</td>
                            <td className="px-4 py-3 text-white/60 text-xs">{ci.user?.studentProfile?.cohort || ci.user?.studentProfile?.section || '—'}</td>
                            <td className="px-4 py-3 text-white/60 text-xs">{checkinTime}</td>
                            <td className="px-4 py-3">
                              {ci.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}
                              {ci.status === 'VERIFIED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                  <ShieldCheck className="w-3 h-3" /> Verified
                                </span>
                              )}
                              {ci.status === 'REJECTED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25">
                                  <ShieldX className="w-3 h-3" /> Rejected
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {ci.status === 'PENDING' && (
                                  <>
                                    <button
                                      onClick={() => handleVerify(ci.id, 'VERIFIED')}
                                      disabled={isActing}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all text-xs font-medium disabled:opacity-50"
                                    >
                                      {isActing ? <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                                      Verify
                                    </button>
                                    <button
                                      onClick={() => handleVerify(ci.id, 'REJECTED', 'Absent')}
                                      disabled={isActing}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all text-xs font-medium disabled:opacity-50"
                                    >
                                      <ShieldX className="w-3 h-3" /> Mark Absent
                                    </button>
                                  </>
                                )}
                                {ci.status === 'VERIFIED' && (
                                  <button
                                    onClick={() => handleVerify(ci.id, 'REJECTED', 'Unverified by instructor')}
                                    disabled={isActing}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/30 transition-all text-xs font-medium disabled:opacity-50"
                                  >
                                    {isActing ? <div className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" /> : <ShieldX className="w-3 h-3" />}
                                    Unverify
                                  </button>
                                )}
                                {ci.status === 'REJECTED' && (
                                  <button
                                    onClick={() => handleVerify(ci.id, 'VERIFIED')}
                                    disabled={isActing}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all text-xs font-medium disabled:opacity-50"
                                  >
                                    {isActing ? <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                                    Re-verify
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Feedback Tab Content */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {feedbackData.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <MessageSquare className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">No feedback received yet</p>
              <p className="text-xs text-white/25 mt-1">Feedback will appear here after workshops complete</p>
            </div>
          ) : (
            feedbackData.map((entry: any) => (
              <div key={entry.eventId} className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{entry.eventTitle}</h3>
                    <p className="text-xs text-white/40 mt-0.5">{entry.totalFeedback} responses · {entry.totalRegistrations} registered</p>
                  </div>
                  <div className="flex gap-4 shrink-0">
                    {entry.avgEventRating !== null && (
                      <div className="text-center">
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= Math.round(entry.avgEventRating) ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`} />
                          ))}
                        </div>
                        <p className="text-[10px] text-white/40 mt-0.5">Event {entry.avgEventRating}/5</p>
                      </div>
                    )}
                    {entry.avgInstructorRating !== null && (
                      <div className="text-center">
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= Math.round(entry.avgInstructorRating) ? 'fill-primary text-primary' : 'text-white/20'}`} />
                          ))}
                        </div>
                        <p className="text-[10px] text-white/40 mt-0.5">Instructor {entry.avgInstructorRating}/5</p>
                      </div>
                    )}
                  </div>
                </div>
                {entry.comments.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
                    {entry.comments.map((c: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                        {c.instructorComment && (
                          <p className="text-xs text-white/70"><span className="text-primary/70 font-medium">About instructor: </span>{c.instructorComment}</p>
                        )}
                        {c.eventComment && (
                          <p className="text-xs text-white/60"><span className="text-white/40 font-medium">About event: </span>{c.eventComment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {entry.comments.length === 0 && entry.totalFeedback > 0 && (
                  <p className="text-xs text-white/30 italic">No written comments submitted</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'workshops' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Now */}
          {liveSessionsNow.length > 0 && (
            <div className="glass-card rounded-2xl p-6 border-emerald-500/20">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">Live Now</h2>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {liveSessionsNow.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Workshops */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Upcoming Workshops</h2>
              <span className="text-xs text-white/40">
                {strictlyUpcoming.length} workshop{strictlyUpcoming.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Filters */}
            <div className="mb-4 space-y-3">
              {/* Workshop Type Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-white/40" />
                <button
                  onClick={() => setWorkshopFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    workshopFilter === 'all'
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  All Workshops
                </button>
                <button
                  onClick={() => setWorkshopFilter('open')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    workshopFilter === 'open'
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  Open Workshops
                </button>
                <button
                  onClick={() => { setWorkshopFilter('course'); setCourseFilter('all'); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    workshopFilter === 'course'
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  Course Workshops
                </button>
              </div>
              
              {/* Course Sub-Filter */}
              {workshopFilter === 'course' && (
                <div className="flex items-center gap-2 flex-wrap pl-6">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Course Type:</span>
                  <button
                    onClick={() => setCourseFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      courseFilter === 'all'
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    All Courses
                  </button>
                  <button
                    onClick={() => setCourseFilter('mentorship')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      courseFilter === 'mentorship'
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Mentorship
                  </button>
                  <button
                    onClick={() => setCourseFilter('leadership')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      courseFilter === 'leadership'
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Leadership
                  </button>
                  <button
                    onClick={() => setCourseFilter('wellness')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      courseFilter === 'wellness'
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Wellness
                  </button>
                </div>
              )}
            </div>
            
            {strictlyUpcoming.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">
                No workshops found for selected filter
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {strictlyUpcoming.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>

          {/* Completed Workshops */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Completed Workshops</h2>
              <span className="text-xs text-white/40">
                {filteredPastWorkshops.length} completed
              </span>
            </div>
            
            {/* Filters */}
            <div className="mb-4 space-y-3">
              {/* Workshop Type Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-white/40" />
                <button
                  onClick={() => setPastWorkshopFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pastWorkshopFilter === 'all'
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  All Workshops
                </button>
                <button
                  onClick={() => setPastWorkshopFilter('open')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pastWorkshopFilter === 'open'
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  Open Workshops
                </button>
                <button
                  onClick={() => setPastWorkshopFilter('course')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pastWorkshopFilter === 'course'
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  Course Workshops
                </button>
              </div>
              
              {/* Date Range Filter */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Date Range:</span>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="input-dark px-3 py-1.5 rounded-lg text-xs"
                  placeholder="Start Date"
                />
                <span className="text-white/30">to</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="input-dark px-3 py-1.5 rounded-lg text-xs"
                  placeholder="End Date"
                />
                {(dateRange.startDate || dateRange.endDate) && (
                  <button
                    onClick={() => setDateRange({ startDate: '', endDate: '' })}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            {filteredPastWorkshops.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">
                No completed workshops found
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPastWorkshops.map((session) => (
                  <PastSessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Calendar */}
          <MiniCalendar
            registeredEventDates={data.upcomingSessions.map(s => s.startAt)}
            unregisteredEventDates={data.pastSessions.map(s => s.startAt)}
            registeredLabel="upcoming session"
            unregisteredLabel="completed session"
            events={[...data.upcomingSessions, ...data.pastSessions].map(s => ({
              id: s.id,
              title: s.title || s.eventTitle,
              date: toLocalDateKey(new Date(s.startAt)),
              time: new Date(s.startAt).toTimeString().slice(0, 5),
              venue: s.venue,
            }))}
          />

          {/* Profile Card */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Profile</h3>
            
            {/* Profile Picture */}
            <div className="flex flex-col items-center mb-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-xl font-bold text-white overflow-hidden">
                  {data.basicInfo.profilePicture ? (
                    <img 
                      src={data.basicInfo.profilePicture} 
                      alt={data.basicInfo.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    data.basicInfo.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                  )}
                </div>
                <button
                  onClick={() => {
                    toast('Profile picture upload coming soon!', { icon: '📸' });
                  }}
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[#ffffff] text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-white/40 mt-2">Click to upload photo</p>
            </div>
            
            <div className="space-y-3">
              {[
                ['Name', data.basicInfo.name],
                ...(data.basicInfo.employeeId ? [['Instructor ID', data.basicInfo.employeeId]] : []),
                ...(data.basicInfo.department && 
                    data.basicInfo.department !== 'Humanities and Social Sciences' && 
                    data.basicInfo.department !== 'Humanities & Social Sciences' 
                    ? [['Specialization', data.basicInfo.department]] 
                    : []),
                ['Role', 'Instructor'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
                  <p className="text-xs text-white/80 font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Online Workshops</span>
                <span className="text-sm font-semibold text-blue-400">
                  {data.upcomingSessions.filter(s => s.mode === 'online').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">In Classroom Workshops</span>
                <span className="text-sm font-semibold text-teal-400">
                  {data.upcomingSessions.filter(s => s.mode === 'in-classroom').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">This Week</span>
                <span className="text-sm font-semibold text-primary">
                  {data.upcomingSessions.filter(s => {
                    const sessionDate = new Date(s.startAt);
                    const weekFromNow = new Date();
                    weekFromNow.setDate(weekFromNow.getDate() + 7);
                    return sessionDate <= weekFromNow;
                  }).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>}
    </DashboardLayout>
  );
}
