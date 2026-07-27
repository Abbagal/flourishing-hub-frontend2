'use client';

import { useState } from 'react';
import { Link2, PlusCircle, X } from 'lucide-react';
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
  quizzes: QuizLibraryItem[];
  onQuizCreated: (quiz: QuizLibraryItem) => void;
  suggestedTitle: string;
}

// Links this module/event to a quiz from the reusable Forms library — either
// by picking an existing one (edits made later in the Forms tab apply here
// too, since it's a reference, not a copy) or authoring a brand new one
// inline, which is saved as a first-class Forms-library quiz immediately.
export default function QuizLinkPicker({ quizId, onChange, quizzes, onQuizCreated, suggestedTitle }: QuizLinkPickerProps) {
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [newTitle, setNewTitle] = useState(suggestedTitle);
  const [newQuestions, setNewQuestions] = useState<QuizQuestionForm[]>(buildEmptyQuizQuestions());
  const [creating, setCreating] = useState(false);

  const linkedQuiz = quizzes.find((q) => q.id === quizId) || null;

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
      const res = await apiCall('/quiz-library', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), questions: newQuestions }),
      });
      const created: QuizLibraryItem = res.data;
      onQuizCreated(created);
      onChange(created.id);
      setMode('select');
      toast.success('Quiz created and linked!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create quiz');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white/60">In-Built Quiz (optional)</p>
        {linkedQuiz && (
          <button
            onClick={() => onChange(null)}
            className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300"
          >
            <X className="w-3 h-3" /> Unlink
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
              onClick={() => setMode('select')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'select' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
            >
              Select Existing
            </button>
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${mode === 'create' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
            >
              <PlusCircle className="w-3 h-3" /> Create New
            </button>
          </div>

          {mode === 'select' ? (
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
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-white/30">Quiz content and question-editing lives in the Forms tab — editing it there updates it everywhere it's linked.</p>
    </div>
  );
}
