'use client';

import { useMemo, useState } from 'react';
import { Search, PlusCircle, Edit2, Trash2, X, FileQuestion } from 'lucide-react';
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

interface FormsTabProps {
  quizzes: QuizLibraryItem[];
  quizzesLoading: boolean;
  onQuizCreated: (quiz: QuizLibraryItem) => void;
  onUpdateQuiz: (id: string, title: string, questions: QuizQuestionForm[]) => Promise<void>;
  onDeleteQuiz: (id: string) => Promise<void>;
}

export default function FormsTab({ quizzes, quizzesLoading, onQuizCreated, onUpdateQuiz, onDeleteQuiz }: FormsTabProps) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<QuizLibraryItem | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestionForm[]>(buildEmptyQuizQuestions());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const filtered = useMemo(
    () => quizzes.filter((q) => q.title.toLowerCase().includes(search.toLowerCase())),
    [quizzes, search],
  );

  const openCreate = () => {
    setEditing('new');
    setTitle('');
    setQuestions(buildEmptyQuizQuestions());
  };

  const openEdit = async (quiz: QuizLibraryItem) => {
    setEditing(quiz);
    setTitle(quiz.title);
    setQuestions(buildEmptyQuizQuestions());
    // The list view only carries a question _count, not the actual question
    // text/options — fetch the full quiz before editing.
    setLoadingQuestions(true);
    try {
      const res = await apiCall(`/quiz-library/${quiz.id}`);
      if (res?.data?.questions?.length === 10) {
        setQuestions(res.data.questions);
      }
    } catch {
      toast.error('Failed to load quiz questions');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const closeEditor = () => setEditing(null);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Quiz title is required');
      return;
    }
    if (questions.filter(isQuizQuestionFilled).length !== 10) {
      toast.error('Fill in all 10 questions.');
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') {
        const res = await apiCall('/quiz-library', {
          method: 'POST',
          body: JSON.stringify({ title: title.trim(), questions }),
        });
        onQuizCreated(res.data);
        toast.success('Quiz created!');
      } else if (editing) {
        await onUpdateQuiz(editing.id, title.trim(), questions);
        toast.success('Quiz updated!');
      }
      closeEditor();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (quiz: QuizLibraryItem) => {
    if (!confirm(`Delete "${quiz.title}"?`)) return;
    setDeletingId(quiz.id);
    try {
      await onDeleteQuiz(quiz.id);
      toast.success('Quiz deleted');
    } catch (error: any) {
      // Backend returns 409 with a message listing linked modules/events
      // when the quiz is still in use — surface that verbatim instead of a
      // generic error.
      toast.error(error?.message || 'Failed to delete quiz', { duration: 6000 });
    } finally {
      setDeletingId(null);
    }
  };

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{editing === 'new' ? 'New Quiz' : 'Edit Quiz'}</h3>
          <button onClick={closeEditor} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-white/60 mb-1.5 block">Quiz Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. MTC-M1-Quiz"
            className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
          />
        </div>
        {loadingQuestions ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <QuizQuestionBuilder questions={questions} onChange={setQuestions} />
        )}
        <div className="flex gap-3">
          <button
            onClick={closeEditor}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingQuestions}
            className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : editing === 'new' ? 'Create Quiz' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Forms</h3>
          <p className="text-xs text-white/40 mt-0.5">Reusable in-built quizzes — create once, link to any course module or standalone event</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all text-sm font-semibold"
        >
          <PlusCircle className="w-4 h-4" /> New Quiz
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quizzes..."
          className="input-dark w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
        />
      </div>

      {quizzesLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          <FileQuestion className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No quizzes yet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((quiz) => {
            const usageCount = (quiz._count?.courseModules ?? 0) + (quiz._count?.events ?? 0);
            return (
              <div key={quiz.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{quiz.title}</p>
                    <p className="text-[11px] text-white/35 mt-1">
                      {quiz._count?.questions ?? 0} questions · used by {usageCount} module/event{usageCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(quiz)}
                      className="p-1.5 rounded-lg text-white/50 hover:text-primary hover:bg-white/5 transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(quiz)}
                      disabled={deletingId === quiz.id}
                      className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/5 transition-all disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
