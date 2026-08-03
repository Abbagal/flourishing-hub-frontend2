'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Calendar, ChevronDown, Download, Edit2, FileText,
  Plus, Search, Upload, Users, Wifi, WifiOff, X,
} from 'lucide-react';
import VolunteerAssignment from '@/components/VolunteerAssignment';
import { formatDate, formatTime } from '@/lib/utils';
import type { Event } from '@/types';

type EventStatus = 'published' | 'completed' | 'draft' | 'cancelled';

const statusColors: Record<EventStatus, string> = {
  published: 'badge-green',
  completed: 'bg-gray-500/15 text-gray-400 border border-gray-500/30 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
  draft: 'badge-yellow',
  cancelled: 'bg-red-500/15 text-red-400 border border-red-500/30 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
};

interface EventsTabProps {
  eventsLoading: boolean;
  events: Event[];
  sortedEvents: Event[];
  draftFilter: boolean;
  setDraftFilter: (fn: (prev: boolean) => boolean) => void;
  courseFilter: string;
  setCourseFilter: (v: string) => void;
  courses: any[];
  setShowBulkImport: (v: boolean) => void;
  openCreate: () => void;
  openEdit: (event: Event) => void;
  handleDelete: (eventId: string, eventTitle: string) => void;
  deleting: string | null;
  expandedEvents: Set<string>;
  setExpandedEvents: (fn: (prev: Set<string>) => Set<string>) => void;
  exportToCSV: (data: any[], filename: string) => void;
  exporting: boolean;
  router: { push: (path: string) => void };
}

export default function EventsTab({
  eventsLoading,
  events,
  sortedEvents,
  draftFilter,
  setDraftFilter,
  courseFilter,
  setCourseFilter,
  courses,
  setShowBulkImport,
  openCreate,
  openEdit,
  handleDelete,
  deleting,
  expandedEvents,
  setExpandedEvents,
  exportToCSV,
  exporting,
  router,
}: EventsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'COMPULSORY' | 'OPTIONAL_BUNDLE' | 'OPEN'>('');

  return (
    <div className="space-y-6" id="events">
      {eventsLoading && events.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-white/40 py-4">
          <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          Loading events...
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-white">Event Management</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workshops, courses, venue..."
              className="input-dark w-64 pl-9 pr-4 py-2 rounded-xl text-sm"
            />
          </div>

          {/* Draft filter toggle */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setDraftFilter(f => !f)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${draftFilter ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}
          >
            <FileText className="w-4 h-4" /> Drafts
          </motion.button>

          {/* Course Filter */}
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="input-dark px-4 py-2 rounded-xl text-sm font-medium"
          >
            <option value="">All Workshops</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Registration Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="input-dark px-4 py-2 rounded-xl text-sm font-medium"
          >
            <option value="">All Types</option>
            <option value="COMPULSORY">Compulsory</option>
            <option value="OPTIONAL_BUNDLE">Optional</option>
            <option value="OPEN">Open</option>
          </select>

          {/* Bulk Import */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-all"
          >
            <Upload className="w-4 h-4" /> Bulk Import
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={openCreate}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Create Event
          </motion.button>
        </div>
      </div>

      <div className="space-y-6">
        {sortedEvents
          .filter(event => {
            if (draftFilter && event.status !== 'draft') return false;
            if (courseFilter && (event as any).courseId !== courseFilter) return false;
            if (typeFilter && (event as any).registrationMode !== typeFilter) return false;
            if (searchQuery.trim()) {
              const q = searchQuery.trim().toLowerCase();
              const haystack = [
                event.title,
                event.venue,
                (event as any).course?.name,
                (event as any).courseModule?.title,
                (event as any).batch,
              ].filter(Boolean).join(' ').toLowerCase();
              if (!haystack.includes(q)) return false;
            }
            return true;
          })
          .map((event) => (
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
                  <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                    event.status === 'published' ? 'bg-emerald-400' :
                    event.status === 'draft' ? 'bg-yellow-400' : 'bg-gray-500'
                  }`} />
                  <div className="min-w-0 flex-1">
                    {/* Course / workshop-type label — always shown first so every
                        card identifies what kind of workshop it is at a glance,
                        regardless of which flow (bulk import or Create Event)
                        published it. */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <BookOpen className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      <span className="text-xs font-semibold text-primary/90 uppercase tracking-wide truncate">
                        {(event as any).course?.name || (
                          (event as any).registrationMode === 'COMPULSORY' ? 'Compulsory Workshop' :
                          (event as any).type === 'OPEN_WORKSHOP' || (event as any).registrationMode === 'OPTIONAL_BUNDLE' ? 'Optional / Open Workshop' :
                          'Workshop'
                        )}
                        {(event as any).courseModule && <span className="text-primary/60 normal-case"> › {(event as any).courseModule.title}</span>}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="text-lg font-bold text-white">{event.title}</h4>
                      <span className={statusColors[event.status]}>{event.status}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        event.mode === 'Online'
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                      }`}>
                        {event.mode === 'Online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {event.mode}
                      </span>
                      {(event as any).batch && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/5 text-white/50 text-xs border border-white/10">
                          {(event as any).batch}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-white/60 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(event.date)} · {formatTime(event.time)}
                      </span>
                      <span>{event.venue}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(event);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(event.id, event.title);
                    }}
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

            {/* Expandable Details */}
            {expandedEvents.has(event.id) && <div className="p-6 border-b border-white/5 bg-white/[0.01]">
              <p className="text-sm text-white/50">{event.description}</p>
            </div>}

            {/* Event Stats */}
            {expandedEvents.has(event.id) && <div className="p-6 border-b border-white/5">
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
            </div>}

            {/* Registration Details */}
            {expandedEvents.has(event.id) && <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h5 className="text-sm font-semibold text-white">Registered Participants</h5>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      // Export event registrations with real data
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
                        'Event': event.title
                      })) || [];

                      if (eventRegistrations.length > 0) {
                        exportToCSV(eventRegistrations, `${event.title.replace(/\s+/g, '_')}_registrations`);
                      } else {
                        // toast is not accessible here, but exportToCSV handles empty arrays
                        exportToCSV([], `${event.title.replace(/\s+/g, '_')}_registrations`);
                      }
                    }}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-all disabled:opacity-50"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </motion.button>
                </div>
              </div>

              {event.registeredCount > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {/* Real registered users from database */}
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
                              <>
                                <span>•</span>
                                <span>{registration.user.department}</span>
                              </>
                            )}
                            {registration.user.yearOfStudy && (
                              <>
                                <span>•</span>
                                <span>Year {registration.user.yearOfStudy}</span>
                              </>
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
                    // Fallback if registrations array is empty but count > 0
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
            </div>}

            {/* Volunteer Assignment Section */}
            {expandedEvents.has(event.id) && <VolunteerAssignment eventId={event.id} />}
          </motion.div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-lg">No events created yet</p>
          <p className="text-white/30 text-sm mt-1">Create your first event to get started</p>
        </div>
      )}
    </div>
  );
}
