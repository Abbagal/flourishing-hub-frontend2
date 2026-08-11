'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { Link2, PlusCircle, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import type { QuizLibraryItem, QuizQuestionForm } from '@/types';
import QuizQuestionBuilder from '@/components/QuizQuestionBuilder';

const buildEmptyQuizQuestions = (): QuizQuestionForm[] =>
  Array.from({ length: 10 }, () => ({
    questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A' as const,
  }));

const isQuizQuestionFilled = (q: QuizQuestionForm) =>
  Boolean(q.questionText.trim() && q.optionA.trim() && q.optionB.trim() && q.optionC.trim() && q.optionD.trim());

interface QuizLinkPickerProps {
  quizId: string | null;
  onChange: (quizId: string | null) => void;
  quizLink: string;
  onLinkChange: (link: string) => void;
  // Second external Google-Form link — "Post Session Quiz". quizLink becomes
  // "Pre Session Quiz" once this is also set (see the student-facing page
  // for the unlock-rule split); with only one of the two filled in, it's
  // still just a single unlabeled quiz link with the old gating.
  postQuizLink: string;
  onPostLinkChange: (link: string) => void;
  quizzes: QuizLibraryItem[];
  onQuizCreated: (quiz: QuizLibraryItem) => void;
  suggestedTitle: string;
}

export interface QuizLinkPickerHandle {
  // Called by the parent modal right before it saves the module/event — see
  // FeedbackLinkPickerHandle for why this exists (silent draft loss when the
  // admin fills in "Create New" but clicks the modal's main Save button
  // instead of this picker's own "Save & Link" button).
  flushPendingCreate: () => Promise<string | null>;
}

// A single source for this module/event's quiz — exactly one of: an
// external Google Form link, or an in-built quiz (picked from the Forms
// library or authored inline). The three modes are mutually exclusive so a
// quizId and a quizLink can never both be set at once — there is nothing
// for either to "override", by construction.
const QuizLinkPicker = forwardRef<QuizLinkPickerHandle, QuizLinkPickerProps>(function QuizLinkPicker(
  { quizId, onChange, quizLink, onLinkChange, postQuizLink, onPostLinkChange, quizzes, onQuizCreated, suggestedTitle },
  ref
) {
  const [mode, setMode] = useState<'link' | 'select' | 'create'>(quizLink || postQuizLink ? 'link' : 'select');
  const [newTitle, setNewTitle] = useState(suggestedTitle);
  const [newQuestions, setNewQuestions] = useState<QuizQuestionForm[]>(buildEmptyQuizQuestions());
  const [creating, setCreating] = useState(false);

  const linkedQuiz = quizzes.find((q) => q.id === quizId) || null;
  const hasLink = Boolean(quizLink.trim());
  const hasPostLink = Boolean(postQuizLink.trim());

  const switchMode = (next: 'link' | 'select' | 'create') => {
    // Switching away from the link mode abandons whatever URLs were typed —
    // keeps the "exactly one source" invariant intact. postQuizLink only
    // ever pairs with the external-link mode (both must be Google Forms,
    // never one link + one in-built quiz), so it's cleared alongside quizLink.
    if (mode === 'link' && next !== 'link') {
      if (hasLink) onLinkChange('');
      if (hasPostLink) onPostLinkChange('');
    }
    setMode(next);
  };

  const handleClear = () => {
    onChange(null);
    onLinkChange('');
    onPostLinkChange('');
    setMode('select');
  };

  const createQuiz = async (): Promise<string> => {
    const res = await apiCall('/quiz-library', {
      method: 'POST',
      body: JSON.stringify({ title: newTitle.trim(), questions: newQuestions }),
    });
    const created: QuizLibraryItem = res.data;
    onQuizCreated(created);
    onChange(created.id);
    setMode('select');
    return created.id;
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error('Quiz title is required');
      return;
    }
    const filledCount = newQuestions.filter(isQuizQuestionFilled).length;
    if (filledCount !== 10) {
      toast.error('Fill in all 10 questions to create the quiz.');
      return;
    }
    try {
      setCreating(true);
      await createQuiz();
      toast.success('Quiz created and linked!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create quiz');
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
        toast.error('Quiz title is required');
        throw new Error('Quiz title is required');
      }
      const filledCount = newQuestions.filter(isQuizQuestionFilled).length;
      if (filledCount !== 10) {
        toast.error('Fill in all 10 questions to create the quiz.');
        throw new Error('Incomplete quiz questions');
      }
      setCreating(true);
      try {
        return await createQuiz();
      } finally {
        setCreating(false);
      }
    },
  }));

  return (
    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white/60">Quiz Source</p>
        {(linkedQuiz || hasLink || hasPostLink) && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {linkedQuiz ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
          <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{linkedQuiz.title}</p>
            <p className="text-[10px] text-white/35">
              {linkedQuiz._count?.questions ?? 10} questions
              {linkedQuiz._count ? ` · used by ${linkedQuiz._count.courseModules + linkedQuiz._count.events} module/event(s)` : ''}
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
            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] font-medium text-white/40 mb-1 block">
                  Pre Session Quiz Link — opens as soon as the student checks in
                </label>
                <input
                  value={quizLink}
                  onChange={(e) => onLinkChange(e.target.value)}
                  placeholder="https://forms.gle/..."
                  className="input-dark w-full px-3 py-2 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-white/40 mb-1 block">
                  Post Session Quiz Link (optional) — unlocks once the session is halfway through
                </label>
                <input
                  value={postQuizLink}
                  onChange={(e) => onPostLinkChange(e.target.value)}
                  placeholder="https://forms.gle/..."
                  className="input-dark w-full px-3 py-2 rounded-lg text-sm"
                />
              </div>
            </div>
          ) : mode === 'select' ? (
            <select
              value={quizId || ''}
              onChange={(e) => onChange(e.target.value || null)}
              className="input-dark w-full px-3 py-2 rounded-lg text-sm"
            >
              <option value="">— No quiz —</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          ) : (
            <div className="space-y-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Quiz title (e.g. MTC-M1-Quiz)"
                className="input-dark w-full px-3 py-2 rounded-lg text-sm"
              />
              <QuizQuestionBuilder questions={newQuestions} onChange={setNewQuestions} />
              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 text-xs font-semibold disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Save New Quiz & Link'}
              </button>
              <p className="text-[10px] text-amber-400/70">
                Tip: you can also just fill this in and click the modal&apos;s main Save button below — it&apos;ll be created and linked automatically.
              </p>
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-white/30">In-built quiz content and question-editing lives in the Forms tab — editing it there updates it everywhere it&apos;s linked.</p>
    </div>
  );
});

export default QuizLinkPicker;
