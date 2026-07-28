'use client';

import { useMemo, useState } from 'react';
import { Search, PlusCircle, Edit2, Trash2, X, FileQuestion, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import type { QuizLibraryItem, QuizQuestionForm, FeedbackLibraryItem, FeedbackQuestionForm } from '@/types';
import QuizQuestionBuilder from '@/components/QuizQuestionBuilder';
import FeedbackQuestionBuilder from '@/components/FeedbackQuestionBuilder';

const buildEmptyQuizQuestions = (): QuizQuestionForm[] =>
  Array.from({ length: 10 }, () => ({
    questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A' as const,
  }));

const isQuizQuestionFilled = (q: QuizQuestionForm) =>
  Boolean(q.questionText.trim() && q.optionA.trim() && q.optionB.trim() && q.optionC.trim() && q.optionD.trim());

const buildEmptyFeedbackQuestions = (): FeedbackQuestionForm[] => [
  { questionText: '', type: 'TEXT', optionA: '', optionB: '', optionC: '', optionD: '' },
];

const isFeedbackQuestionFilled = (q: FeedbackQuestionForm) =>
  Boolean(q.questionText.trim()) &&
  (q.type !== 'MCQ' || Boolean(q.optionA?.trim() && q.optionB?.trim() && q.optionC?.trim() && q.optionD?.trim()));

interface FormsTabProps {
  quizzes: QuizLibraryItem[];
  quizzesLoading: boolean;
  onQuizCreated: (quiz: QuizLibraryItem) => void;
  onUpdateQuiz: (id: string, title: string, questions: QuizQuestionForm[]) => Promise<void>;
  onDeleteQuiz: (id: string) => Promise<void>;
  feedbacks: FeedbackLibraryItem[];
  feedbacksLoading: boolean;
  onFeedbackCreated: (form: FeedbackLibraryItem) => void;
  onUpdateFeedback: (id: string, title: string, questions: FeedbackQuestionForm[]) => Promise<void>;
  onDeleteFeedback: (id: string) => Promise<void>;
}

export default function FormsTab({
  quizzes, quizzesLoading, onQuizCreated, onUpdateQuiz, onDeleteQuiz,
  feedbacks, feedbacksLoading, onFeedbackCreated, onUpdateFeedback, onDeleteFeedback,
}: FormsTabProps) {
  const [section, setSection] = useState<'quiz' | 'feedback'>('quiz');
  const [search, setSearch] = useState('');

  const [editingQuiz, setEditingQuiz] = useState<QuizLibraryItem | 'new' | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionForm[]>(buildEmptyQuizQuestions());
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [loadingQuizQuestions, setLoadingQuizQuestions] = useState(false);

  const [editingFeedback, setEditingFeedback] = useState<FeedbackLibraryItem | 'new' | null>(null);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackQuestions, setFeedbackQuestions] = useState<FeedbackQuestionForm[]>(buildEmptyFeedbackQuestions());
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [loadingFeedbackQuestions, setLoadingFeedbackQuestions] = useState(false);

  const filteredQuizzes = useMemo(
    () => quizzes.filter((q) => q.title.toLowerCase().includes(search.toLowerCase())),
    [quizzes, search],
  );
  const filteredFeedbacks = useMemo(
    () => feedbacks.filter((f) => f.title.toLowerCase().includes(search.toLowerCase())),
    [feedbacks, search],
  );

  const openCreateQuiz = () => {
    setEditingQuiz('new');
    setQuizTitle('');
    setQuizQuestions(buildEmptyQuizQuestions());
  };

  const openEditQuiz = async (quiz: QuizLibraryItem) => {
    setEditingQuiz(quiz);
    setQuizTitle(quiz.title);
    setQuizQuestions(buildEmptyQuizQuestions());
    // The list view only carries a question _count, not the actual question
    // text/options — fetch the full quiz before editing.
    setLoadingQuizQuestions(true);
    try {
      const res = await apiCall(`/quiz-library/${quiz.id}`);
      if (res?.data?.questions?.length === 10) {
        setQuizQuestions(res.data.questions);
      }
    } catch {
      toast.error('Failed to load quiz questions');
    } finally {
      setLoadingQuizQuestions(false);
    }
  };

  const closeQuizEditor = () => setEditingQuiz(null);

  const handleSaveQuiz = async () => {
    if (!quizTitle.trim()) {
      toast.error('Quiz title is required');
      return;
    }
    if (quizQuestions.filter(isQuizQuestionFilled).length !== 10) {
      toast.error('Fill in all 10 questions.');
      return;
    }
    setSavingQuiz(true);
    try {
      if (editingQuiz === 'new') {
        const res = await apiCall('/quiz-library', {
          method: 'POST',
          body: JSON.stringify({ title: quizTitle.trim(), questions: quizQuestions }),
        });
        onQuizCreated(res.data);
        toast.success('Quiz created!');
      } else if (editingQuiz) {
        await onUpdateQuiz(editingQuiz.id, quizTitle.trim(), quizQuestions);
        toast.success('Quiz updated!');
      }
      closeQuizEditor();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save quiz');
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleDeleteQuiz = async (quiz: QuizLibraryItem) => {
    if (!confirm(`Delete "${quiz.title}"?`)) return;
    setDeletingQuizId(quiz.id);
    try {
      await onDeleteQuiz(quiz.id);
      toast.success('Quiz deleted');
    } catch (error: any) {
      // Backend returns 409 with a message listing linked modules/events
      // when the quiz is still in use — surface that verbatim instead of a
      // generic error.
      toast.error(error?.message || 'Failed to delete quiz', { duration: 6000 });
    } finally {
      setDeletingQuizId(null);
    }
  };

  const openCreateFeedback = () => {
    setEditingFeedback('new');
    setFeedbackTitle('');
    setFeedbackQuestions(buildEmptyFeedbackQuestions());
  };

  const openEditFeedback = async (form: FeedbackLibraryItem) => {
    setEditingFeedback(form);
    setFeedbackTitle(form.title);
    setFeedbackQuestions(buildEmptyFeedbackQuestions());
    setLoadingFeedbackQuestions(true);
    try {
      const res = await apiCall(`/feedback-library/${form.id}`);
      if (res?.data?.questions?.length) {
        setFeedbackQuestions(res.data.questions);
      }
    } catch {
      toast.error('Failed to load feedback form questions');
    } finally {
      setLoadingFeedbackQuestions(false);
    }
  };

  const closeFeedbackEditor = () => setEditingFeedback(null);

  const handleSaveFeedback = async () => {
    if (!feedbackTitle.trim()) {
      toast.error('Feedback form title is required');
      return;
    }
    if (!feedbackQuestions.length || !feedbackQuestions.every(isFeedbackQuestionFilled)) {
      toast.error('Fill in every question (and all 4 options for multiple-choice).');
      return;
    }
    setSavingFeedback(true);
    try {
      if (editingFeedback === 'new') {
        const res = await apiCall('/feedback-library', {
          method: 'POST',
          body: JSON.stringify({ title: feedbackTitle.trim(), questions: feedbackQuestions }),
        });
        onFeedbackCreated(res.data);
        toast.success('Feedback form created!');
      } else if (editingFeedback) {
        await onUpdateFeedback(editingFeedback.id, feedbackTitle.trim(), feedbackQuestions);
        toast.success('Feedback form updated!');
      }
      closeFeedbackEditor();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save feedback form');
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleDeleteFeedback = async (form: FeedbackLibraryItem) => {
    if (!confirm(`Delete "${form.title}"?`)) return;
    setDeletingFeedbackId(form.id);
    try {
      await onDeleteFeedback(form.id);
      toast.success('Feedback form deleted');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete feedback form', { duration: 6000 });
    } finally {
      setDeletingFeedbackId(null);
    }
  };

  if (editingQuiz) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{editingQuiz === 'new' ? 'New Quiz' : 'Edit Quiz'}</h3>
          <button onClick={closeQuizEditor} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-white/60 mb-1.5 block">Quiz Title *</label>
          <input
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="e.g. MTC-M1-Quiz"
            className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
          />
        </div>
        {loadingQuizQuestions ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <QuizQuestionBuilder questions={quizQuestions} onChange={setQuizQuestions} />
        )}
        <div className="flex gap-3">
          <button
            onClick={closeQuizEditor}
            disabled={savingQuiz}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveQuiz}
            disabled={savingQuiz || loadingQuizQuestions}
            className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {savingQuiz ? 'Saving…' : editingQuiz === 'new' ? 'Create Quiz' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  if (editingFeedback) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{editingFeedback === 'new' ? 'New Feedback Form' : 'Edit Feedback Form'}</h3>
          <button onClick={closeFeedbackEditor} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-white/60 mb-1.5 block">Feedback Form Title *</label>
          <input
            value={feedbackTitle}
            onChange={(e) => setFeedbackTitle(e.target.value)}
            placeholder="e.g. MTC-M1-Feedback"
            className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
          />
        </div>
        {loadingFeedbackQuestions ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <FeedbackQuestionBuilder questions={feedbackQuestions} onChange={setFeedbackQuestions} />
        )}
        <div className="flex gap-3">
          <button
            onClick={closeFeedbackEditor}
            disabled={savingFeedback}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveFeedback}
            disabled={savingFeedback || loadingFeedbackQuestions}
            className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {savingFeedback ? 'Saving…' : editingFeedback === 'new' ? 'Create Feedback Form' : 'Save Changes'}
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
          <p className="text-xs text-white/40 mt-0.5">
            {section === 'quiz'
              ? 'Reusable in-built quizzes — create once, link to any course module or standalone event'
              : 'Reusable in-built feedback forms — create once, link to any course module or standalone event'}
          </p>
        </div>
        <button
          onClick={section === 'quiz' ? openCreateQuiz : openCreateFeedback}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all text-sm font-semibold"
        >
          <PlusCircle className="w-4 h-4" /> {section === 'quiz' ? 'New Quiz' : 'New Feedback Form'}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setSection('quiz')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${section === 'quiz' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
        >
          <FileQuestion className="w-4 h-4" /> Quizzes
        </button>
        <button
          onClick={() => setSection('feedback')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${section === 'feedback' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-white/5 text-white/50 border border-white/10'}`}
        >
          <MessageSquare className="w-4 h-4" /> Feedback Forms
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={section === 'quiz' ? 'Search quizzes...' : 'Search feedback forms...'}
          className="input-dark w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
        />
      </div>

      {section === 'quiz' ? (
        quizzesLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">
            <FileQuestion className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No quizzes yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredQuizzes.map((quiz) => {
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
                        onClick={() => openEditQuiz(quiz)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-primary hover:bg-white/5 transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(quiz)}
                        disabled={deletingQuizId === quiz.id}
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
        )
      ) : feedbacksLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No feedback forms yet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFeedbacks.map((form) => {
            const usageCount = (form._count?.courseModules ?? 0) + (form._count?.events ?? 0);
            return (
              <div key={form.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{form.title}</p>
                    <p className="text-[11px] text-white/35 mt-1">
                      {form._count?.questions ?? 0} question{form._count?.questions === 1 ? '' : 's'} · used by {usageCount} module/event{usageCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditFeedback(form)}
                      className="p-1.5 rounded-lg text-white/50 hover:text-primary hover:bg-white/5 transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFeedback(form)}
                      disabled={deletingFeedbackId === form.id}
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
