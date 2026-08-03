'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Calendar, Plus, X, Edit2, AlertTriangle,
  Wifi, WifiOff, Check, Download, ChevronDown, BookOpen, Trash2, Square, CheckSquare,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import VolunteerAssignment from '@/components/VolunteerAssignment';
import { apiCall } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { toLocalDateKey, isEventLive } from '@/lib/dateUtils';
import { downloadCsv } from '@/lib/csv';
import toast from 'react-hot-toast';

type EventStatus = 'published' | 'completed' | 'draft' | 'cancelled';

interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  endTime: string;
  venue: string;
  mode: 'Online' | 'In Classroom';
  capacity: string;
  status: EventStatus;
  courseId: string;
  courseModuleId: string;
  batch: string;
  posterUrl: string;
  quizLink: string;
  feedbackLink: string;
  instructorId: string;
  associateInstructorId: string;
  maxVolunteers: string;
}

const emptyForm: EventFormData = {
  title: '', description: '', date: '', time: '',
  venue: '', mode: 'In Classroom', capacity: '', status: 'published',
  courseId: '', courseModuleId: '', batch: '', posterUrl: '', quizLink: '', feedbackLink: '',
  endTime: '', instructorId: '', associateInstructorId: '', maxVolunteers: '',
};

const statusColors: Record<EventStatus, string> = {
  published: 'badge-green',
  completed: 'bg-gray-500/15 text-gray-400 border border-gray-500/30 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
  draft: 'badge-yellow',
  cancelled: 'bg-red-500/15 text-red-400 border border-red-500/30 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
};

const transformEventsData = (rawEvents: any[]) => rawEvents.map((event: any) => ({
  id: event.id,
  title: event.title,
  description: event.description,
  date: toLocalDateKey(new Date(event.startAt)),
  time: new Date(event.startAt).toTimeString().slice(0, 5),
  endTime: event.endAt ? new Date(event.endAt).toTimeString().slice(0, 5) : '',
  venue: event.venue || 'TBD',
  mode: (event.meetLink ? 'Online' : 'In Classroom') as 'Online' | 'In Classroom',
  capacity: event.capacity || 0,
  registeredCount: event._count?.registrations || 0,
  status: event.status.toLowerCase() as EventStatus,
  organizer: event.createdBy?.name || 'Admin',
  registrations: event.registrations || [],
  registrationStats: event.registrationStats || {
    total: 0, students: 0, volunteers: 0,
    fillRate: 0, available: event.capacity || 0
  },
  courseId: event.courseId || null,
  courseModuleId: event.courseModuleId || null,
  course: event.course || null,
  courseModule: event.courseModule || null,
  batch: event.batch || null,
  bannerImageUrl: event.bannerImageUrl || null,
  maxVolunteers: event.maxVolunteers || null,
  assignments: event.assignments || [],
  instructorName: event.assignments?.find((a: any) => a.role === 'INSTRUCTOR')?.user?.name || null,
  instructorId: event.assignments?.find((a: any) => a.role === 'INSTRUCTOR')?.user?.id || null,
  associateInstructorName: event.assignments?.find((a: any) => a.role === 'ASSOCIATE_INSTRUCTOR')?.user?.name || null,
  associateInstructorId: event.assignments?.find((a: any) => a.role === 'ASSOCIATE_INSTRUCTOR')?.user?.id || null,
  quizLink: event.modules?.[0]?.quizLink || null,
}));

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{ id: string; title: string } | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [modulesForEvent, setModulesForEvent] = useState<any[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showCourseDeleteModal, setShowCourseDeleteModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [eventsResponse, coursesResponse, membersResponse] = await Promise.all([
          apiCall('/admin/events-with-registrations'),
          apiCall('/courses').catch(() => ({ data: [] })),
          apiCall('/admin/members').catch(() => ({ data: [] })),
        ]);
        setEvents(transformEventsData(eventsResponse.data));
        setCourses(coursesResponse.data || []);
        const allMembers = membersResponse.data || [];
        const normalizeRole = (r: string) => r?.toLowerCase().replace(/_/g, '-');
        setStaffList(
          allMembers
            .filter((m: any) => ['instructor', 'associate-instructor'].includes(normalizeRole(m.role)))
            .sort((a: any, b: any) => a.name.localeCompare(b.name))
        );
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const refreshEvents = async () => {
    const eventsResponse = await apiCall('/admin/events-with-registrations');
    setEvents(transformEventsData(eventsResponse.data));
  };

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setModulesForEvent([]);
    setShowModal(true);
  };

  const openEdit = (event: any) => {
    setEditingEvent(event);
    const ev = event as any;
    setForm({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      endTime: ev.endTime || '',
      venue: event.venue,
      mode: event.mode,
      capacity: String(event.capacity),
      status: event.status,
      courseId: ev.courseId || '',
      courseModuleId: ev.courseModuleId || '',
      batch: ev.batch || '',
      posterUrl: ev.bannerImageUrl || '',
      quizLink: ev.quizLink || '',
      feedbackLink: ev.feedbackLink || '',
      instructorId: ev.instructorId || '',
      associateInstructorId: ev.associateInstructorId || '',
      maxVolunteers: ev.maxVolunteers ? String(ev.maxVolunteers) : '',
    });
    if (ev.courseId) {
      apiCall(`/courses/${ev.courseId}/modules`).then(r => setModulesForEvent(r.data || [])).catch(() => {});
    } else {
      setModulesForEvent([]);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.date || !form.time || !form.venue || !form.capacity) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (saving) return;

    try {
      setSaving(true);
      const eventData: any = {
        title: form.title,
        description: form.description,
        startAt: new Date(`${form.date}T${form.time}`).toISOString(),
        endAt: form.endTime
          ? new Date(`${form.date}T${form.endTime}`).toISOString()
          : new Date(new Date(`${form.date}T${form.time}`).getTime() + 2 * 60 * 60 * 1000).toISOString(),
        venue: form.venue,
        meetLink: form.mode === 'Online' ? 'https://meet.google.com/placeholder' : null,
        capacity: parseInt(form.capacity),
        status: form.status.toUpperCase(),
        type: 'WELLNESS_COURSE',
        ...(form.courseId && { courseId: form.courseId }),
        ...(form.courseModuleId && { courseModuleId: form.courseModuleId }),
        ...(form.batch && { batch: form.batch }),
        ...(form.posterUrl && { bannerImageUrl: form.posterUrl }),
        ...(form.maxVolunteers && { maxVolunteers: parseInt(form.maxVolunteers) }),
        ...(form.quizLink && {
          modules: [{
            title: form.title,
            startAt: new Date(`${form.date}T${form.time}`).toISOString(),
            endAt: form.endTime
              ? new Date(`${form.date}T${form.endTime}`).toISOString()
              : new Date(new Date(`${form.date}T${form.time}`).getTime() + 2 * 60 * 60 * 1000).toISOString(),
            quizLink: form.quizLink,
          }]
        }),
      };

      if (editingEvent) {
        const editData: any = {
          ...eventData,
          // Always send staff IDs on edit so backend can sync assignments
          instructorId: form.instructorId || null,
          associateInstructorId: form.associateInstructorId || null,
        };
        await apiCall(`/admin/events/${editingEvent.id}`, { method: 'PUT', body: JSON.stringify(editData) });
        toast.success('Event updated!');
      } else {
        // The create endpoint doesn't process instructorId/associateInstructorId
        // in the body, so staff must be attached via a follow-up assign-staff call.
        const createdEvent = await apiCall('/admin/events', { method: 'POST', body: JSON.stringify(eventData) });
        if (createdEvent?.data?.id) {
          const staffCalls = [
            form.instructorId && { userId: form.instructorId, role: 'INSTRUCTOR' },
            form.associateInstructorId && { userId: form.associateInstructorId, role: 'ASSOCIATE_INSTRUCTOR' },
          ].filter(Boolean) as { userId: string; role: string }[];
          for (const s of staffCalls) {
            try {
              await apiCall('/admin/assign-staff', {
                method: 'POST',
                body: JSON.stringify({ eventId: createdEvent.data.id, userId: s.userId, role: s.role }),
              });
            } catch (e: any) {
              toast.error(`Could not assign ${s.role === 'INSTRUCTOR' ? 'instructor' : 'associate instructor'}: ${e?.message || 'unknown error'}`);
            }
          }
        }
        toast.success(form.status === 'published' ? 'Event published!' : 'Event saved as draft');
      }

      setShowModal(false);
      setEditingEvent(null);
      setForm(emptyForm);
      await refreshEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (eventId: string, eventTitle: string) => {
    setEventToDelete({ id: eventId, title: eventTitle });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    try {
      setDeleting(eventToDelete.id);
      await apiCall(`/admin/events/${eventToDelete.id}`, { method: 'DELETE' });
      toast.success('Event deleted successfully!');
      await refreshEvents();
      setShowDeleteModal(false);
      setEventToDelete(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelectEvent = (eventId: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      next.has(eventId) ? next.delete(eventId) : next.add(eventId);
      return next;
    });
  };

  const confirmBulkDelete = async () => {
    if (selectedEventIds.size === 0) return;
    try {
      setBulkDeleting(true);
      const res = await apiCall('/admin/events/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ eventIds: [...selectedEventIds] }),
      });
      toast.success(res.message || `${selectedEventIds.size} event(s) deleted successfully!`);
      setSelectedEventIds(new Set());
      setShowBulkDeleteModal(false);
      await refreshEvents();
    } catch (error) {
      console.error('Error bulk deleting events:', error);
      toast.error('Failed to delete selected events');
    } finally {
      setBulkDeleting(false);
    }
  };

  const confirmDeleteAllInCourse = async () => {
    if (!courseFilter) return;
    try {
      setBulkDeleting(true);
      const res = await apiCall(`/admin/events/course/${courseFilter}`, { method: 'DELETE' });
      toast.success(res.message || 'All events in this course deleted successfully!');
      setSelectedEventIds(new Set());
      setShowCourseDeleteModal(false);
      await refreshEvents();
    } catch (error) {
      console.error('Error deleting course events:', error);
      toast.error('Failed to delete events for this course');
    } finally {
      setBulkDeleting(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) { toast.error('No data to export'); return; }
    setExporting(true);
    try {
      downloadCsv(data, `${filename}_${toLocalDateKey(new Date())}`);
      toast.success(`Exported ${data.length} records to CSV`);
    } catch (error) {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const today = toLocalDateKey(new Date());
  const sortedEvents = [...events].sort((a, b) => {
    const aLive = a.status === 'published' && isEventLive(`${a.date}T${a.time}`, a.endTime ? `${a.date}T${a.endTime}` : null);
    const bLive = b.status === 'published' && isEventLive(`${b.date}T${b.time}`, b.endTime ? `${b.date}T${b.endTime}` : null);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    const aIsToday = a.date === today && a.status === 'published';
    const bIsToday = b.date === today && b.status === 'published';
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const filteredEvents = sortedEvents.filter(event => {
    if (!courseFilter) return true;
    return (event as any).courseId === courseFilter;
  });

  return (
    <DashboardLayout loading={loading}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">Event Management</h1>
        <p className="text-sm text-white/50 mt-1">Create, edit, and manage all events</p>
      </motion.div>

      {/* Header Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <select
            value={courseFilter}
            onChange={(e) => { setCourseFilter(e.target.value); setSelectedEventIds(new Set()); }}
            className="input-dark px-4 py-2 rounded-xl text-sm font-medium"
          >
            <option value="">All Workshops</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {courseFilter && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowCourseDeleteModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Delete All in Course ({filteredEvents.length})
            </motion.button>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Create Event
        </motion.button>
      </div>

      {/* Bulk Selection Bar */}
      {filteredEvents.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10">
          <button
            onClick={() => {
              const allSelected = filteredEvents.every((e) => selectedEventIds.has(e.id));
              setSelectedEventIds(allSelected ? new Set() : new Set(filteredEvents.map((e) => e.id)));
            }}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            {filteredEvents.length > 0 && filteredEvents.every((e) => selectedEventIds.has(e.id)) ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {selectedEventIds.size > 0 ? `${selectedEventIds.size} selected` : 'Select all'}
          </button>
          {selectedEventIds.size > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected ({selectedEventIds.size})
            </motion.button>
          )}
        </div>
      )}

      {/* Events List */}
      <div className="space-y-6">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 text-lg">No events created yet</p>
            <p className="text-white/30 text-sm mt-1">Create your first event to get started</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => router.push(`/admin/events/${event.id}`)}
              className="rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border-2 border-white/10 hover:border-primary/30 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            >
              {/* Event Header */}
              <div className="p-6 border-b border-white/5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelectEvent(event.id); }}
                      className="shrink-0 mt-0.5"
                    >
                      {selectedEventIds.has(event.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-white/25 hover:text-white/50 transition-colors" />
                      )}
                    </button>
                    <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                      event.status === 'published' ? 'bg-emerald-400' :
                      event.status === 'draft' ? 'bg-yellow-400' : 'bg-gray-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="text-lg font-bold text-white">{event.title}</h4>
                        <span className={statusColors[event.status as EventStatus]}>{event.status}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          event.mode === 'Online'
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            : 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                        }`}>
                          {event.mode === 'Online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {event.mode}
                        </span>
                        {(event as any).course && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                            <BookOpen className="w-3 h-3" />
                            {(event as any).course.name}
                            {(event as any).courseModule && (
                              <span className="text-primary/70"> › {(event as any).courseModule.title}</span>
                            )}
                          </span>
                        )}
                        {(event as any).batch && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/5 text-white/50 text-xs border border-white/10">
                            {(event as any).batch}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-white/60 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(event.date)} · {formatTime(event.time)}
                        </span>
                        <span>{event.venue}</span>
                        {event.instructorName && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {event.instructorName}
                            {event.associateInstructorName && ` · ${event.associateInstructorName}`}
                          </span>
                        )}
                        {event.maxVolunteers && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/10 text-green-400 text-xs border border-green-500/20">
                            {event.maxVolunteers} volunteer slots
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); openEdit(event); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(event.id, event.title); }}
                      disabled={deleting === event.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      {deleting === event.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      Delete
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedEvents(prev => {
                          const next = new Set(prev);
                          next.has(event.id) ? next.delete(event.id) : next.add(event.id);
                          return next;
                        });
                      }}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <motion.div animate={{ rotate: expandedEvents.has(event.id) ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Expandable Description */}
              {expandedEvents.has(event.id) && (
                <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                  <p className="text-sm text-white/50">{event.description}</p>
                </div>
              )}

              {/* Event Stats */}
              {expandedEvents.has(event.id) && (
                <div className="p-6 border-b border-white/5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-2xl font-bold text-white mb-1">{event.registeredCount}</div>
                      <div className="text-xs text-white/50">Registered</div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-2xl font-bold text-white mb-1">{event.capacity > 0 ? event.capacity : 'Unlimited'}</div>
                      <div className="text-xs text-white/50">Capacity</div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-2xl font-bold text-emerald-400 mb-1">
                        {event.capacity > 0 ? Math.round((event.registeredCount / event.capacity) * 100) : 0}%
                      </div>
                      <div className="text-xs text-white/50">Fill Rate</div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-2xl font-bold text-blue-400 mb-1">
                        {event.capacity > 0 ? event.capacity - event.registeredCount : 'Unlimited'}
                      </div>
                      <div className="text-xs text-white/50">Available</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Registered Participants */}
              {expandedEvents.has(event.id) && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-sm font-semibold text-white">Registered Participants</h5>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        const eventRegistrations = (event as any).registrations?.map((reg: any) => ({
                          Name: reg.user.name,
                          Email: reg.user.email,
                          'Roll Number': reg.user.rollNumber || '',
                          Department: reg.user.department || '',
                          Programme: reg.user.programme || '',
                          Year: reg.user.yearOfStudy || '',
                          Section: reg.user.section || '',
                          Cohort: reg.user.cohort || '',
                          'Is Volunteer': reg.isVolunteer ? 'Yes' : 'No',
                          'Registration Date': new Date(reg.registeredAt).toLocaleDateString(),
                          Event: event.title
                        })) || [];
                        if (eventRegistrations.length > 0) {
                          exportToCSV(eventRegistrations, `${event.title.replace(/\s+/g, '_')}_registrations`);
                        } else {
                          toast.error('No registrations to export');
                        }
                      }}
                      disabled={exporting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-all disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" /> Export
                    </motion.button>
                  </div>

                  {event.registeredCount > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(event as any).registrations?.map((registration: any) => (
                        <div key={registration.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-white font-bold text-xs">
                              {registration.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{registration.user.name}</p>
                              <div className="flex items-center gap-2 text-xs text-white/50">
                                <span>{registration.user.rollNumber || registration.user.email}</span>
                                {registration.user.department && (
                                  <><span>•</span><span>{registration.user.department}</span></>
                                )}
                                {registration.user.yearOfStudy && (
                                  <><span>•</span><span>Year {registration.user.yearOfStudy}</span></>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {registration.isVolunteer && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30">
                                Volunteer
                              </span>
                            )}
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Registered
                            </span>
                            <span className="text-xs text-white/40">
                              {new Date(registration.registeredAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      )) || (
                        <div className="text-center py-4">
                          <p className="text-white/40 text-sm">Registration details loading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                      <p className="text-white/40">No registrations yet</p>
                      <p className="text-white/30 text-sm mt-1">Participants will appear here once they register</p>
                    </div>
                  )}
                </div>
              )}

              {/* Volunteer Assignment */}
              {expandedEvents.has(event.id) && <VolunteerAssignment eventId={event.id} />}
            </motion.div>
          ))
        )}
      </div>

      {/* Create/Edit Event Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              style={{ background: 'rgb(var(--color-card))' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h3 className="text-base font-semibold text-white">
                  {editingEvent ? 'Edit Event' : 'Create Event'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Course & Module Selection */}
                {courses.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                    <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Link to Course (optional)</p>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1.5 block">Course / Program</label>
                      <select
                        value={form.courseId}
                        onChange={async (e) => {
                          const cId = e.target.value;
                          setForm({ ...form, courseId: cId, courseModuleId: '' });
                          if (cId) {
                            try {
                              const r = await apiCall(`/courses/${cId}/modules`);
                              setModulesForEvent(r.data || []);
                            } catch { setModulesForEvent([]); }
                          } else {
                            setModulesForEvent([]);
                          }
                        }}
                        className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                      >
                        <option value="">— No course —</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    {form.courseId && modulesForEvent.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-white/60 mb-1.5 block">Module (auto-fills details)</label>
                        <select
                          value={form.courseModuleId}
                          onChange={(e) => {
                            const mId = e.target.value;
                            const mod = modulesForEvent.find(m => m.id === mId);
                            if (mod) {
                              setForm({
                                ...form,
                                courseModuleId: mId,
                                title: form.title || mod.title,
                                description: form.description || mod.description || '',
                                posterUrl: mod.posterUrl || form.posterUrl,
                                quizLink: mod.quizLink || '',
                                feedbackLink: mod.feedbackLink || '',
                              });
                            } else {
                              setForm({ ...form, courseModuleId: mId });
                            }
                          }}
                          className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                        >
                          <option value="">— No module —</option>
                          {modulesForEvent.map(m => (
                            <option key={m.id} value={m.id}>{m.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Workshop Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Introduction to Mindfulness - Batch 2024"
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Workshop description..."
                    rows={2}
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Date *</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Start Time *</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">End Time</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Venue *</label>
                  <input
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    placeholder="e.g. LT 101, Lecture Complex"
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Target Batch / Cohort</label>
                  <input
                    value={form.batch}
                    onChange={(e) => setForm({ ...form, batch: e.target.value })}
                    placeholder="e.g. BTech 2024, MTech 2023"
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>

                {/* Instructor & Associate Instructor */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Facilitators</p>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Instructor</label>
                    <select
                      value={form.instructorId}
                      onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    >
                      <option value="">— Select Instructor —</option>
                      {staffList.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role?.toLowerCase().replace(/_/g, ' ')})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Associate Instructor</label>
                    <select
                      value={form.associateInstructorId}
                      onChange={(e) => setForm({ ...form, associateInstructorId: e.target.value })}
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    >
                      <option value="">— Select Associate Instructor —</option>
                      {staffList.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role?.toLowerCase().replace(/_/g, ' ')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Volunteer Slots */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Volunteers</p>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Max Volunteer Slots</label>
                    <input
                      type="number"
                      value={form.maxVolunteers}
                      onChange={(e) => setForm({ ...form, maxVolunteers: e.target.value })}
                      placeholder="e.g. 5 (leave blank if not needed)"
                      min="0"
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                    <p className="text-xs text-white/30 mt-1">Number of volunteer slots available for this event</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Mode</label>
                    <div className="flex gap-2">
                      {(['Online', 'In Classroom'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setForm({ ...form, mode: m })}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                            form.mode === m
                              ? m === 'Online'
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                : 'bg-teal-500/20 text-teal-400 border-teal-500/40'
                              : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {m === 'Online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Capacity *</label>
                    <input
                      type="number"
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                      placeholder="e.g. 60"
                      min="1"
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Quiz Link</label>
                    <input
                      value={form.quizLink}
                      onChange={(e) => setForm({ ...form, quizLink: e.target.value })}
                      placeholder="https://forms.gle/..."
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1.5 block">Feedback Link</label>
                    <input
                      value={form.feedbackLink}
                      onChange={(e) => setForm({ ...form, feedbackLink: e.target.value })}
                      placeholder="https://forms.gle/..."
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Status</label>
                  <div className="flex gap-2">
                    {([
                      { val: 'draft' as EventStatus, label: 'Draft', cls: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' },
                      { val: 'published' as EventStatus, label: 'Publish (Active)', cls: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
                    ]).map(({ val, label, cls }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm({ ...form, status: val })}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          form.status === val ? cls : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {form.status === val && <Check className="w-3 h-3" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: saving ? 1 : 1.02 }}
                  whileTap={{ scale: saving ? 1 : 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#ffffff] border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    form.status === 'published' ? 'Publish Event' : 'Save Event'
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && eventToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6"
              style={{ background: 'rgb(var(--color-card))' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Delete Event</h3>
                  <p className="text-xs text-white/50">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-white/70 mb-6">
                Are you sure you want to delete <span className="text-white font-medium">"{eventToDelete.title}"</span>? All registrations will also be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setEventToDelete(null); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={!!deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : 'Delete Event'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Selected Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6"
              style={{ background: 'rgb(var(--color-card))' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Delete Selected Events</h3>
                  <p className="text-xs text-white/50">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-white/70 mb-6">
                Are you sure you want to delete <span className="text-white font-medium">{selectedEventIds.size} event{selectedEventIds.size !== 1 ? 's' : ''}</span>? All their registrations, attendance, and feedback will also be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkDelete}
                  disabled={bulkDeleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {bulkDeleting ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : `Delete ${selectedEventIds.size} Event${selectedEventIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete All Events in Course Confirmation Modal */}
      <AnimatePresence>
        {showCourseDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6"
              style={{ background: 'rgb(var(--color-card))' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Delete All Events in Course</h3>
                  <p className="text-xs text-white/50">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-white/70 mb-6">
                Are you sure you want to delete <span className="text-white font-medium">all {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}</span> under{' '}
                <span className="text-white font-medium">{courses.find((c) => c.id === courseFilter)?.name || 'this course'}</span>?
                All their registrations, attendance, and feedback will also be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCourseDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAllInCourse}
                  disabled={bulkDeleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {bulkDeleting ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : 'Delete All in Course'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
