'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { FeedbackQuestionForm, FeedbackQuestionType } from '@/types';

const OPTION_FIELDS: Array<'optionA' | 'optionB' | 'optionC' | 'optionD'> = [
  'optionA', 'optionB', 'optionC', 'optionD',
];

const emptyQuestion = (): FeedbackQuestionForm => ({
  questionText: '', type: 'TEXT', optionA: '', optionB: '', optionC: '', optionD: '',
});

interface FeedbackQuestionBuilderProps {
  questions: FeedbackQuestionForm[];
  onChange: (questions: FeedbackQuestionForm[]) => void;
}

// Flexible-count, mixed-type feedback question builder — unlike
// QuizQuestionBuilder's fixed 10 MCQ slots, an admin can add/remove any
// number of questions here, each independently Text / Rating / MCQ. No
// correct-option concept — feedback isn't graded.
export default function FeedbackQuestionBuilder({ questions, onChange }: FeedbackQuestionBuilderProps) {
  const updateQuestion = (index: number, patch: Partial<FeedbackQuestionForm>) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => onChange([...questions, emptyQuestion()]);
  const removeQuestion = (index: number) => onChange(questions.filter((_, i) => i !== index));

  return (
    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-4">
      <div>
        <p className="text-xs font-medium text-white/60">Feedback Form Questions</p>
        <p className="text-[11px] text-white/35 mt-0.5">
          Add as many questions as you need — each can be a written answer, a 1-5 rating, or multiple choice.
        </p>
      </div>
      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
        {questions.map((q, index) => (
          <div key={index} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-white/50">Question {index + 1}</span>
              <div className="flex items-center gap-2">
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(index, { type: e.target.value as FeedbackQuestionType })}
                  className="input-dark px-2 py-1 rounded-md text-xs"
                >
                  <option value="TEXT">Text</option>
                  <option value="RATING">Rating (1-5)</option>
                  <option value="MCQ">Multiple Choice</option>
                </select>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="p-1 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="Remove question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={q.questionText}
              onChange={(e) => updateQuestion(index, { questionText: e.target.value })}
              placeholder={`Question ${index + 1} text`}
              rows={2}
              className="input-dark w-full px-3 py-2 rounded-lg text-sm resize-none"
            />
            {q.type === 'MCQ' && (
              <div className="flex flex-col gap-2">
                {OPTION_FIELDS.map((field, i) => (
                  <input
                    key={field}
                    value={q[field] || ''}
                    onChange={(e) => updateQuestion(index, { [field]: e.target.value } as Partial<FeedbackQuestionForm>)}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    className="input-dark w-full px-3 py-1.5 rounded-lg text-sm"
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addQuestion}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Question
      </button>
    </div>
  );
}
