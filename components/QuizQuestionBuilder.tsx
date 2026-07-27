'use client';

import type { QuizQuestionForm, QuizOptionKey } from '@/types';

const OPTION_KEYS: QuizOptionKey[] = ['A', 'B', 'C', 'D'];
const OPTION_FIELD: Record<QuizOptionKey, 'optionA' | 'optionB' | 'optionC' | 'optionD'> = {
  A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD',
};

interface QuizQuestionBuilderProps {
  questions: QuizQuestionForm[];
  onChange: (questions: QuizQuestionForm[]) => void;
}

// Fixed 10-slot MCQ builder shared by ModuleModal (quiz authored once per
// reusable CourseModule) and EventModal (quiz authored directly on a
// standalone/open-workshop Event). No add/remove controls — the count is
// always exactly 10.
export default function QuizQuestionBuilder({ questions, onChange }: QuizQuestionBuilderProps) {
  const updateQuestion = (index: number, patch: Partial<QuizQuestionForm>) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  return (
    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-4">
      <div>
        <p className="text-xs font-medium text-white/60">In-Built Quiz (10 Questions)</p>
        <p className="text-[11px] text-white/35 mt-0.5">
          Optional — fill in all 10 questions to enable it, or leave every question blank to skip.
        </p>
      </div>
      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
        {questions.map((q, index) => (
          <div key={index} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
            <span className="text-[11px] font-semibold text-white/50">Question {index + 1}</span>
            <textarea
              value={q.questionText}
              onChange={(e) => updateQuestion(index, { questionText: e.target.value })}
              placeholder={`Question ${index + 1} text`}
              rows={2}
              className="input-dark w-full px-3 py-2 rounded-lg text-sm resize-none"
            />
            <div className="flex flex-col gap-2">
              {OPTION_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`q${index}-correct`}
                    checked={q.correctOption === key}
                    onChange={() => updateQuestion(index, { correctOption: key })}
                    className="accent-primary shrink-0"
                  />
                  <input
                    value={q[OPTION_FIELD[key]]}
                    onChange={(e) =>
                      updateQuestion(index, { [OPTION_FIELD[key]]: e.target.value } as Partial<QuizQuestionForm>)
                    }
                    placeholder={`Option ${key}`}
                    className="input-dark w-full px-3 py-1.5 rounded-lg text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/30">Select the radio button next to each question&apos;s correct option.</p>
    </div>
  );
}
