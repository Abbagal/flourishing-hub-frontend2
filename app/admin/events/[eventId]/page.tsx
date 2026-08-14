'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, Edit2, Save, X,
  CheckCircle, UserCheck, Heart, Download, Wifi, WifiOff, Star, XCircle
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import { apiCall } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';
import toast from 'react-hot-toast';

interface EventDetail {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  mode: string;
  capacity: number;
  status: string;
  registeredCount: number;
  batchUploadTotal?: number;
  attendedCount: number;
  registrants: any[];
  volunteers: any[];
  attendees: any[];
}

export default function AdminEventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.eventId as string;
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
    }
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const response = await apiCall(`/admin/events/${eventId}/details`);
      setEvent(response.data);
      setEditedDescription(response.data.description);
    } catch (error) {
      console.error('Failed to fetch event details:', error);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDescription = async () => {
    try {
      await apiCall(`/admin/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify({ description: editedDescription })
      });
      toast.success('Description updated successfully');
      setEditing(false);
      if (event) {
        setEvent({ ...event, description: editedDescription });
      }
    } catch (error) {
      toast.error('Failed to update description');
    }
  };

  const exportRegistrants = () => {
    if (!event) return;
    const data = (event.registrants || []).map(r => ({
      Name: r.user?.name || '',
      Email: r.user?.email || '',
      'Roll No': r.user?.studentProfile?.rollNumber || 'N/A',
      Department: r.user?.studentProfile?.department || 'N/A',
      'Registered At': formatDate(r.registeredAt),
      Status: r.status,
      'Quiz Score': r.quizScore != null ? `${r.quizScore}/5` : 'Not submitted',
      Rating: r.eventRating != null ? `${r.eventRating}/5` : 'Not rated',
    }));
    if (!downloadCsv(data, `${event.title}_registrants`)) {
      toast.error('No registrants to export');
    }
  };

  const exportAttendees = () => {
    if (!event) return;
    const data = (event.attendees || []).map(a => ({
      Name: a.user?.name || '',
      Email: a.user?.email || '',
      'Roll No': a.user?.studentProfile?.rollNumber || 'N/A',
      Department: a.user?.studentProfile?.department || 'N/A',
      Status: a.status,
      'Marked At': formatDate(a.markedAt)
    }));
    if (!downloadCsv(data, `${event.title}_attendees`)) {
      toast.error('No attendees to export');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-white/50">Loading event details...</div>
      </DashboardLayout>
    );
  }

  if (!event) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-white/50">Event not found</div>
      </DashboardLayout>
    );
  }

  const isUpcoming = new Date(`${event.date}T${event.time}`) > new Date();
  const registrantsData = event.registrants.map(r => ({
    name: r.user.name,
    email: r.user.email,
    rollNo: r.user.studentProfile?.rollNumber || 'N/A',
    department: r.user.studentProfile?.department || 'N/A',
    registeredAt: formatDate(r.registeredAt),
    rawRegisteredAt: r.registeredAt,
    status: r.status,
    quizScore: r.quizScore,
    quizSubmitted: r.quizScore !== null && r.quizScore !== undefined,
    eventRating: r.eventRating,
    checkInStatus: r.checkInStatus,
  }));

  const volunteersData = event.volunteers.map(v => ({
    name: v.user.name,
    email: v.user.email,
    role: v.role || 'VOLUNTEER',
    status: v.isAvailable ? 'Available' : 'Not Available'
  }));

  const attendeesData = event.attendees.map(a => ({
    name: a.user.name,
    email: a.user.email,
    rollNo: a.user.studentProfile?.rollNumber || 'N/A',
    status: a.status,
    markedAt: formatDate(a.markedAt),
    rawMarkedAt: a.markedAt
  }));

  return (
    <DashboardLayout>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => router.push('/admin#events')}
          className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">{event.title}</h1>
            <div className="flex items-center gap-4 text-sm text-white/60">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(event.date)} · {formatTime(event.time)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.venue}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
                event.mode === 'Online'
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                  : 'bg-teal-500/15 text-teal-400 border-teal-500/30'
              }`}>
                {event.mode === 'Online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {event.mode}
              </span>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            event.status === 'published' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            event.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            {event.status}
          </span>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white mb-1">
            {event.batchUploadTotal ? (
              <>
                <span className="text-emerald-400">{event.registeredCount}</span>
                <span className="text-white/40"> / {event.batchUploadTotal}</span>
              </>
            ) : (
              event.registeredCount
            )}
          </div>
          <div className="text-xs text-white/50">
            {event.batchUploadTotal ? 'Registered (of CSV batch)' : 'Registered'}
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white mb-1">{event.capacity > 0 ? event.capacity : 'Unlimited'}</div>
          <div className="text-xs text-white/50">Capacity</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400 mb-1">
            {event.capacity > 0 ? Math.round((event.registeredCount / event.capacity) * 100) : 0}%
          </div>
          <div className="text-xs text-white/50">Fill Rate</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400 mb-1">
            {isUpcoming ? (event.capacity > 0 ? event.capacity - event.registeredCount : 'Unlimited') : event.attendedCount}
          </div>
          <div className="text-xs text-white/50">{isUpcoming ? 'Available' : 'Attended'}</div>
        </div>
      </div>

      {/* Description */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Description</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDescription}
                className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditedDescription(event.description);
                }}
                className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-primary/50 focus:outline-none transition-colors resize-none"
            rows={4}
          />
        ) : (
          <p className="text-sm text-white/70">{event.description}</p>
        )}
      </div>

      {/* Registrants */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">
            Registered Participants ({event.registeredCount})
          </h2>
          <button
            onClick={exportRegistrants}
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
        <DataTable
          data={registrantsData as unknown as Record<string, unknown>[]}
          columns={[
            { key: 'name', label: 'Name', sortable: true },
            { key: 'email', label: 'Email', sortable: true },
            { key: 'rollNo', label: 'Roll No' },
            { key: 'department', label: 'Department' },
            { key: 'registeredAt', label: 'Registered At', sortable: true, sortValue: (row: any) => new Date(row.rawRegisteredAt).getTime() },
            {
              key: 'status',
              label: 'Status',
              render: (value: string) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  value === 'REGISTERED' ? 'bg-emerald-500/20 text-emerald-400' :
                  value === 'ATTENDED' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {value}
                </span>
              )
            },
            {
              key: 'checkInStatus',
              label: 'Check-In',
              sortable: true,
              // PENDING = the student checked in but no instructor has
              // reviewed it yet — distinct from null (never checked in at
              // all), which previously looked identical in the attendance
              // list and could sit unverified indefinitely unnoticed.
              render: (value: string | null) => (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  value === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' :
                  value === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                  value === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {value === 'VERIFIED' ? <CheckCircle className="w-3 h-3" /> : value === 'PENDING' ? <Clock className="w-3 h-3" /> : value === 'REJECTED' ? <XCircle className="w-3 h-3" /> : null}
                  {value === 'PENDING' ? 'Needs Review' : value || 'Not checked in'}
                </span>
              )
            },
            {
              key: 'quizSubmitted',
              label: 'Quiz',
              sortable: true,
              // Set by the Google Form's Apps Script webhook (POST /quiz/submit)
              // when the student actually submits — not just "opened the link".
              render: (value: boolean, row: any) => value ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                  <CheckCircle className="w-3 h-3" /> {row.quizScore}/5
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400">
                  <XCircle className="w-3 h-3" /> Not submitted
                </span>
              )
            },
            {
              key: 'eventRating',
              label: 'Rating',
              sortable: true,
              render: (value: number | null) => value != null ? (
                <span className="inline-flex items-center gap-1 text-yellow-400 font-semibold text-xs">
                  <Star className="w-3 h-3 fill-yellow-400" /> {value}/5
                </span>
              ) : (
                <span className="text-white/30 text-xs">Not rated</span>
              )
            },
          ]}
          searchKeys={['name', 'email', 'rollNo'] as never[]}
          searchPlaceholder="Search participants..."
          emptyMessage="No registrants yet"
        />
      </div>

      {/* Volunteers */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">
          Volunteers ({event.volunteers.length})
        </h2>
        <DataTable
          data={volunteersData as unknown as Record<string, unknown>[]}
          columns={[
            { key: 'name', label: 'Name', sortable: true },
            { key: 'email', label: 'Email', sortable: true },
            { key: 'role', label: 'Role' },
            { 
              key: 'status', 
              label: 'Status',
              render: (value: string) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  value === 'Available' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {value}
                </span>
              )
            },
          ]}
          searchKeys={['name', 'email'] as never[]}
          searchPlaceholder="Search volunteers..."
          emptyMessage="No volunteers yet"
        />
      </div>

      {/* Attendees (for completed workshops) */}
      {!isUpcoming && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              Attendees ({event.attendedCount})
            </h2>
            <button
              onClick={exportAttendees}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <DataTable
            data={attendeesData as unknown as Record<string, unknown>[]}
            columns={[
              { key: 'name', label: 'Name', sortable: true },
              { key: 'email', label: 'Email', sortable: true },
              { key: 'rollNo', label: 'Roll No' },
              { 
                key: 'status', 
                label: 'Status',
                render: (value: string) => (
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    value === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-400' :
                    value === 'ABSENT' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {value}
                  </span>
                )
              },
              { key: 'markedAt', label: 'Marked At', sortable: true, sortValue: (row: any) => new Date(row.rawMarkedAt).getTime() },
            ]}
            searchKeys={['name', 'email', 'rollNo'] as never[]}
            searchPlaceholder="Search attendees..."
            emptyMessage="No attendance records yet"
          />
        </div>
      )}
    </DashboardLayout>
  );
}
