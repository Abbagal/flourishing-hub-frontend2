'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { QuizLibraryItem } from '@/types';
import QuizLinkPicker from '../QuizLinkPicker';

interface ModuleFormData {
  title: string;
  description: string;
  posterUrl: string;
  quizLink: string;
  feedbackLink: string;
  duration: string;
  order: string;
  quizId: string | null;
}

interface ModuleModalProps {
  showModuleModal: boolean;
  setShowModuleModal: (v: boolean) => void;
  editingModule: any | null;
  selectedCourse: any | null;
  moduleForm: ModuleFormData;
  setModuleForm: (form: ModuleFormData) => void;
  handleSaveModule: () => void;
  savingModule: boolean;
  quizzes: QuizLibraryItem[];
  onQuizCreated: (quiz: QuizLibraryItem) => void;
}

export default function ModuleModal({
  showModuleModal,
  setShowModuleModal,
  editingModule,
  selectedCourse,
  moduleForm,
  setModuleForm,
  handleSaveModule,
  savingModule,
  quizzes,
  onQuizCreated,
}: ModuleModalProps) {
  return (
    <AnimatePresence>
      {showModuleModal && (
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
              <div>
                <h3 className="text-base font-semibold text-white">
                  {editingModule ? 'Edit Module' : 'Add Module'}
                </h3>
                {selectedCourse && (
                  <p className="text-xs text-white/40 mt-0.5">to: {selectedCourse.name}</p>
                )}
              </div>
              <button onClick={() => setShowModuleModal(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Module Title *</label>
                <input
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  placeholder="e.g. Introduction to Mindfulness"
                  className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Brief Description</label>
                <textarea
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  placeholder="Short description of this module..."
                  rows={2}
                  className="input-dark w-full px-4 py-2.5 rounded-xl text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Poster / Banner URL</label>
                <input
                  value={moduleForm.posterUrl}
                  onChange={(e) => setModuleForm({ ...moduleForm, posterUrl: e.target.value })}
                  placeholder="https://example.com/poster.jpg"
                  className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Quiz Link (optional)</label>
                  <input
                    value={moduleForm.quizLink}
                    onChange={(e) => setModuleForm({ ...moduleForm, quizLink: e.target.value })}
                    placeholder="https://forms.gle/..."
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Feedback Link (optional)</label>
                  <input
                    value={moduleForm.feedbackLink}
                    onChange={(e) => setModuleForm({ ...moduleForm, feedbackLink: e.target.value })}
                    placeholder="https://forms.gle/..."
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Duration (optional)</label>
                  <input
                    value={moduleForm.duration}
                    onChange={(e) => setModuleForm({ ...moduleForm, duration: e.target.value })}
                    placeholder="e.g. 2 hours"
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1.5 block">Order / Sequence</label>
                  <input
                    type="number"
                    value={moduleForm.order}
                    onChange={(e) => setModuleForm({ ...moduleForm, order: e.target.value })}
                    placeholder="0"
                    min="0"
                    className="input-dark w-full px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <QuizLinkPicker
                quizId={moduleForm.quizId}
                onChange={(quizId) => setModuleForm({ ...moduleForm, quizId })}
                quizzes={quizzes}
                onQuizCreated={onQuizCreated}
                suggestedTitle={selectedCourse ? `${selectedCourse.code || selectedCourse.name}-${moduleForm.title || 'Module'}-Quiz` : ''}
              />
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowModuleModal(false)}
                disabled={savingModule}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: savingModule ? 1 : 1.02 }}
                whileTap={{ scale: savingModule ? 1 : 0.98 }}
                onClick={handleSaveModule}
                disabled={savingModule}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingModule ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#ffffff] border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingModule ? 'Update Module' : 'Add Module'
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
