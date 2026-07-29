'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Wifi, WifiOff, X } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import type { Event, QuizLibraryItem, FeedbackLibraryItem } from '@/types';
import QuizLinkPicker, { type QuizLinkPickerHandle } from '../QuizLinkPicker';
import FeedbackLinkPicker, { type FeedbackLinkPickerHandle } from '../FeedbackLinkPicker';
import ApplicableToggle from '../ApplicableToggle';

type EventStatus = 'published' | 'completed' | 'draft' | 'cancelled';
type RegistrationMode = 'compulsory' | 'optional' | 'open';

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
  registrationMode: RegistrationMode;
  quizId: string | null;
  quizApplicable: boolean;
  feedbackApplicable: boolean;
  feedbackFormId: string | null;
}

const VENUE_PRESETS = [
  'LT 101, Lecture Hall Complex',
  'LT 103, Lecture Hall Complex',
  'LT 201, Lecture Hall Complex',
  'LT 301, Main Building',
  'Seminar Hall, Victor Menezes Convention Centre',
  'Online (Google Meet)',
];

// Compulsory Roster / Optional Bundle events are only ever created via Bulk
// Import (which has its own course+workshop-type picker) — Create Event is
// Open Workshop only. This map is just for the read-only badge shown when
// editing an existing event that was created one of those other ways.
const REGISTRATION_MODE_LABELS: Record<RegistrationMode, { label: string; color: string }> = {
  compulsory: { label: 'Compulsory Roster', color: 'amber' },
  optional:   { label: 'Optional Bundle',   color: 'blue'  },
  open:       { label: 'Open Workshop',     color: 'teal'  },
};

interface EventModalProps {
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  editingEvent: Event | null;
  form: EventFormData;
  setForm: (form: EventFormData) => void;
  courses: any[];
  modulesForEvent: any[];
  setModulesForEvent: (modules: any[]) => void;
  instructors: any[];
  associateInstructors: any[];
  handleSave: (overrides?: { quizId?: string; feedbackFormId?: string }) => void;
  saving: boolean;
  quizzes: QuizLibraryItem[];
  onQuizCreated: (quiz: QuizLibraryItem) => void;
  feedbacks: FeedbackLibraryItem[];
  onFeedbackCreated: (form: FeedbackLibraryItem) => void;
}

export default function EventModal({
  showModal,
  setShowModal,
  editingEvent,
  form,
  setForm,
  courses,
  modulesForEvent,
  setModulesForEvent,
  instructors,
  associateInstructors,
  handleSave,
  saving,
  quizzes,
  onQuizCreated,
  feedbacks,
  onFeedbackCreated,
}: EventModalProps) {
  const quizPickerRef = useRef<QuizLinkPickerHandle>(null);
  const feedbackPickerRef = useRef<FeedbackLinkPickerHandle>(null);

  // Flushes any unsaved "Create New" quiz/feedback draft before saving, so
  // clicking this button instead of the picker's own "Save & Link" button
  // never silently discards what the admin typed.
  const handleSaveClick = async () => {
    try {
      const [flushedQuizId, flushedFeedbackId] = await Promise.all([
        form.quizApplicable ? quizPickerRef.current?.flushPendingCreate() : Promise.resolve(null),
        form.feedbackApplicable ? feedbackPickerRef.current?.flushPendingCreate() : Promise.resolve(null),
      ]);
      handleSave({
        quizId: flushedQuizId ?? undefined,
        feedbackFormId: flushedFeedbackId ?? undefined,
      });
    } catch {
      // flushPendingCreate already toasted the validation error — abort the save
    }
  };

  return (
    <AnimatePresence>
      {showModal && (
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

              {/* ── Registration Mode — Create Event only makes Open Workshops;
                   Compulsory Roster / Optional Bundle are Bulk-Import-only. When
                   editing an event that already has one of those modes (created
                   via Bulk Import), show it read-only instead of a picker so it
                   can't be silently switched to Open. ── */}
              {editingEvent && form.registrationMode !== 'open' && (
                <div>
                  <label className="text-xs font-medium text-white/60 mb-2 block">Registration Mode</label>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    REGISTRATION_MODE_LABELS[form.registrationMode].color === 'amber'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                  }`}>
                    {REGISTRATION_MODE_LABELS[form.registrationMode].label}
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">Set via Bulk Import — not editable here.</p>
                </div>
              )}

              {/* ── Linked Course — same idea: Create Event doesn't link a course
                   anymore (that's Bulk Import's job). Read-only when editing an
                   event that's already linked. ── */}
              {editingEvent && form.courseId && (
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                  <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Linked Course</p>
                  <p className="text-sm text-white/70">
                    {(() => {
                      const sel = courses.find(c => c.id === form.courseId);
                      return sel ? (sel.code ? `${sel.code} · ${sel.name}` : sel.name) : 'Course';
                    })()}
                  </p>
                  <p className="text-[10px] text-white/30">Set via Bulk Import — not editable here.</p>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-white/60">Start Time *</label>
                    {form.time && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                        {formatTime(form.time)}
                      </span>
                    )}
                  </div>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-white/60">End Time</label>
                    {form.endTime && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                        {formatTime(form.endTime)}
                      </span>
                    )}
                  </div>
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
                  list="venue-presets"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="e.g. LT 103, Lecture Hall Complex"
                  className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                />
                <datalist id="venue-presets">
                  {VENUE_PRESETS.map((v) => <option key={v} value={v} />)}
                </datalist>
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
                  {instructors.length > 0 ? (
                    <select
                      value={form.instructorId}
                      onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    >
                      <option value="">— Select Instructor —</option>
                      {instructors.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.instructorId}
                      onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                      placeholder="Instructor name"
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Associate Instructor</label>
                  {associateInstructors.length > 0 ? (
                    <select
                      value={form.associateInstructorId}
                      onChange={(e) => setForm({ ...form, associateInstructorId: e.target.value })}
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    >
                      <option value="">— Select Associate Instructor —</option>
                      {associateInstructors.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.associateInstructorId}
                      onChange={(e) => setForm({ ...form, associateInstructorId: e.target.value })}
                      placeholder="Associate instructor name"
                      className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                    />
                  )}
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

              {/* In-built quiz/feedback — only a standalone/open workshop (no
                  linked course) authors its own; a course-linked event's
                  quiz/feedback is inherited from its CourseModule instead
                  (authored once in the Courses tab's module editor). */}
              {!form.courseId && (
                <>
                  <div className="flex gap-3">
                    <ApplicableToggle
                      label="Quiz applicable"
                      checked={form.quizApplicable}
                      onChange={(checked) => setForm({ ...form, quizApplicable: checked, ...(checked ? {} : { quizId: null, quizLink: '' }) })}
                    />
                    <ApplicableToggle
                      label="Feedback applicable"
                      checked={form.feedbackApplicable}
                      onChange={(checked) => setForm({ ...form, feedbackApplicable: checked, ...(checked ? {} : { feedbackFormId: null, feedbackLink: '' }) })}
                    />
                  </div>

                  {form.quizApplicable && (
                    <QuizLinkPicker
                      ref={quizPickerRef}
                      quizId={form.quizId}
                      onChange={(quizId) => setForm({ ...form, quizId })}
                      quizLink={form.quizLink}
                      onLinkChange={(quizLink) => setForm({ ...form, quizLink })}
                      quizzes={quizzes}
                      onQuizCreated={onQuizCreated}
                      suggestedTitle={form.title ? `${form.title}-Quiz` : ''}
                    />
                  )}

                  {form.feedbackApplicable && (
                    <FeedbackLinkPicker
                      ref={feedbackPickerRef}
                      feedbackFormId={form.feedbackFormId}
                      onChange={(feedbackFormId) => setForm({ ...form, feedbackFormId })}
                      feedbackLink={form.feedbackLink}
                      onLinkChange={(feedbackLink) => setForm({ ...form, feedbackLink })}
                      feedbacks={feedbacks}
                      onFormCreated={onFeedbackCreated}
                      suggestedTitle={form.title ? `${form.title}-Feedback` : ''}
                    />
                  )}
                </>
              )}

              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Status</label>
                <div className="flex gap-2">
                  {([
                    { val: 'draft' as EventStatus, label: 'Draft', cls: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' },
                    { val: 'published' as EventStatus, label: 'Publish (Active)', cls: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
                    ...(editingEvent ? [
                      { val: 'completed' as EventStatus, label: 'Completed', cls: 'border-gray-400/40 text-gray-300 bg-gray-500/10' },
                      { val: 'cancelled' as EventStatus, label: 'Cancelled', cls: 'border-red-500/40 text-red-400 bg-red-500/10' },
                    ] : []),
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
                onClick={handleSaveClick}
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
  );
}
