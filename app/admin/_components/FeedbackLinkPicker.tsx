'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { Link2, PlusCircle, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import type { FeedbackLibraryItem, FeedbackQuestionForm } from '@/types';
import FeedbackQuestionBuilder from '@/components/FeedbackQuestionBuilder';

const buildEmptyFeedbackQuestions = (): FeedbackQuestionForm[] => [
  { questionText: '', type: 'TEXT', optionA: '', optionB: '', optionC: '', optionD: '' },
];

const isFeedbackQuestionFilled = (q: FeedbackQuestionForm) =>
  Boolean(q.questionText.trim()) &&
  (q.type !== 'MCQ' || Boolean(q.optionA?.trim() && q.optionB?.trim() && q.optionC?.trim() && q.optionD?.trim()));

interface FeedbackLinkPickerProps {
  feedbackFormId: string | null;
  onChange: (feedbackFormId: string | null) => void;
  feedbackLink: string;
  onLinkChange: (link: string) => void;
  feedbacks: FeedbackLibraryItem[];
  onFormCreated: (form: FeedbackLibraryItem) => void;
  suggestedTitle: string;
}

export interface FeedbackLinkPickerHandle {
  // Called by the parent modal right before it saves the module/event — if
  // the admin typed a "Create New" draft but clicked the modal's main Save
  // button instead of this picker's own "Save & Link" button, that draft
  // would otherwise be silently discarded (the modal only ever persists
  // whatever `feedbackFormId` already is, which is still null at that
  // point). This flushes an untouched draft as a no-op, but actually
  // creates+links a filled-in one so the modal's save can pick up the new
  // id. Throws (with a toast already shown) if a non-empty draft fails
  // validation, so the caller can abort the save rather than lose it.
  flushPendingCreate: () => Promise<string | null>;
}

// Same "exactly one source" pattern as QuizLinkPicker: an external Google
// Form link, or an in-built feedback form (picked or authored inline) — the
// three modes are mutually exclusive so a feedbackFormId and a feedbackLink
// can never both be set at once.
const FeedbackLinkPicker = forwardRef<FeedbackLinkPickerHandle, FeedbackLinkPickerProps>(function FeedbackLinkPicker(
  { feedbackFormId, onChange, feedbackLink, onLinkChange, feedbacks, onFormCreated, suggestedTitle },
  ref
) {
  const [mode, setMode] = useState<'link' | 'select' | 'create'>(feedbackLink ? 'link' : 'select');
  const [newTitle, setNewTitle] = useState(suggestedTitle);
  const [newQuestions, setNewQuestions] = useState<FeedbackQuestionForm[]>(buildEmptyFeedbackQuestions());
  const [creating, setCreating] = useState(false);

  const linkedForm = feedbacks.find((f) => f.id === feedbackFormId) || null;
  const hasLink = Boolean(feedbackLink.trim());

  const switchMode = (next: 'link' | 'select' | 'create') => {
    if (mode === 'link' && next !== 'link' && hasLink) onLinkChange('');
    setMode(next);
  };

  const handleClear = () => {
    onChange(null);
    onLinkChange('');
    setMode('select');
  };

  const createForm = async (): Promise<string> => {
    const res = await apiCall('/feedback-library', {
      method: 'POST',
      body: JSON.stringify({ title: newTitle.trim(), questions: newQuestions }),
    });
    const created: FeedbackLibraryItem = res.data;
    onFormCreated(created);
    onChange(created.id);
    setMode('select');
    return created.id;
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error('Feedback form title is required');
      return;
    }
    if (!newQuestions.length || !newQuestions.every(isFeedbackQuestionFilled)) {
      toast.error('Fill in every question (and all 4 options for multiple-choice) to create the form.');
      return;
    }
    try {
      setCreating(true);
      await createForm();
      toast.success('Feedback form created and linked!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create feedback form');
    } finally {
      setCreating(false);
    }
  };

  useImperativeHandle(ref, () => ({
    flushPendingCreate: async () => {
      if (mode !== 'create') return null;
      const hasAnyContent = newTitle.trim() || newQuestions.some((q) => q.questionText.trim());
      if (!hasAnyContent) return null;
      if (!newTitle.trim()) {
        toast.error('Feedback form title is required');
        throw new Error('Feedback form title is required');
      }
      if (!newQuestions.length || !newQuestions.every(isFeedbackQuestionFilled)) {
        toast.error('Fill in every question (and all 4 options for multiple-choice) to create the form.');
        throw new Error('Incomplete feedback form questions');
      }
      setCreating(true);
      try {
        return await createForm();
      } finally {
        setCreating(false);
      }
    },
  }));

  return (
    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white/60">Feedback Source</p>
        {(linkedForm || hasLink) && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {linkedForm ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
          <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{linkedForm.title}</p>
            <p className="text-[10px] text-white/35">
              {linkedForm._count?.questions ?? '—'} question(s)
              {linkedForm._count ? ` · used by ${linkedForm._count.courseModules + linkedForm._count.events} module/event(s)` : ''}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => switchMode('link')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'link' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
            >
              <ExternalLink className="w-3 h-3" /> Google Form Link
            </button>
            <button
              onClick={() => switchMode('select')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'select' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
            >
              Select Existing
            </button>
            <button
              onClick={() => switchMode('create')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'create' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
            >
              <PlusCircle className="w-3 h-3" /> Create New
            </button>
          </div>

          {mode === 'link' ? (
            <input
              value={feedbackLink}
              onChange={(e) => onLinkChange(e.target.value)}
              placeholder="https://forms.gle/..."
              className="input-dark w-full px-3 py-2 rounded-lg text-sm"
            />
          ) : mode === 'select' ? (
            <select
              value={feedbackFormId || ''}
              onChange={(e) => onChange(e.target.value || null)}
              className="input-dark w-full px-3 py-2 rounded-lg text-sm"
            >
              <option value="">— No feedback form —</option>
              {feedbacks.map((f) => (
                <option key={f.id} value={f.id}>{f.title}</option>
              ))}
            </select>
          ) : (
            <div className="space-y-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Feedback form title (e.g. MTC-M1-Feedback)"
                className="input-dark w-full px-3 py-2 rounded-lg text-sm"
              />
              <FeedbackQuestionBuilder questions={newQuestions} onChange={setNewQuestions} />
              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 text-xs font-semibold disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Save New Feedback Form & Link'}
              </button>
              <p className="text-[10px] text-amber-400/70">
                Tip: you can also just fill this in and click the modal&apos;s main Save button below — it&apos;ll be created and linked automatically.
              </p>
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-white/30">In-built feedback content and question-editing lives in the Forms tab — editing it there updates it everywhere it&apos;s linked.</p>
    </div>
  );
});

export default FeedbackLinkPicker;
