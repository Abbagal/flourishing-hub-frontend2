'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Calendar, ClipboardList, Copy, Edit2, FileQuestion, Layers, Link2, Plus, Star, X } from 'lucide-react';
import type { Event } from '@/types';
import toast from 'react-hot-toast';

type CourseStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

const courseStatusColors: Record<CourseStatus, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
  INACTIVE: 'bg-gray-500/15 text-gray-400 border border-gray-500/30 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
  ARCHIVED: 'bg-orange-500/15 text-orange-400 border border-orange-500/30 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
};

interface CoursesTabProps {
  courses: any[];
  selectedCourse: any | null;
  courseModules: any[];
  loadingModules: boolean;
  deletingCourse: string | null;
  deletingModule: string | null;
  courseStaff: any | null;
  courseStaffLoading: boolean;
  openCreateCourse: () => void;
  openEditCourse: (course: any) => void;
  handleDeleteCourse: (courseId: string, courseName: string) => void;
  handleViewModules: (course: any) => void;
  handleBackToCourses: () => void;
  openCreateModule: () => void;
  openEditModule: (mod: any) => void;
  handleDeleteModule: (moduleId: string, moduleTitle: string) => void;
  handleCreateWorkshopFromModule: (mod: any) => void;
}

export default function CoursesTab({
  courses,
  selectedCourse,
  courseModules,
  loadingModules,
  deletingCourse,
  deletingModule,
  courseStaff,
  courseStaffLoading,
  openCreateCourse,
  openEditCourse,
  handleDeleteCourse,
  handleViewModules,
  handleBackToCourses,
  openCreateModule,
  openEditModule,
  handleDeleteModule,
  handleCreateWorkshopFromModule,
}: CoursesTabProps) {
  return (
    <div className="space-y-6" id="courses">
      {!selectedCourse ? (
        /* ── Course List View ── */
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Course Management</h3>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={openCreateCourse}
                className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              >
                <Plus className="w-4 h-4" /> Create Course Template
              </motion.button>
            </div>
          </div>

          <div className="space-y-4">
            {courses.map((course) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10 hover:border-primary/30 overflow-hidden transition-all duration-300"
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Poster thumbnail */}
                    {course.posterUrl ? (
                      <img src={course.posterUrl} alt={course.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shrink-0">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h4 className="text-base font-bold text-white">{course.name}</h4>
                        <span className={courseStatusColors[course.status as CourseStatus]}>{course.status}</span>
                        {course.isCompulsory && (
                          <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                            <Star className="w-3 h-3 fill-amber-400" /> Required
                          </span>
                        )}
                        {course.hasQuiz && (
                          <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                            <FileQuestion className="w-3 h-3" /> Quiz
                          </span>
                        )}
                      </div>
                      {course.description && (
                        <p className="text-sm text-white/50 mb-2 line-clamp-2">{course.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span className="text-white/70 font-medium">{course._count?.modules ?? 0}</span> modules
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span className="text-white/70 font-medium">{course._count?.events ?? 0}</span> workshops conducted
                        </span>
                        {course.instructorName && <span>by {course.instructorName}</span>}
                        {course.isCompulsory && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(course.id);
                              toast.success('Course ID copied — paste into the Google Form quiz script');
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all font-mono text-[11px]"
                            title="Copy Course ID (for the Google Form quiz webhook's COMPULSORY_COURSE_ID)"
                          >
                            <Copy className="w-3 h-3" /> Course ID
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <motion.button
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => handleViewModules(course)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all"
                      >
                        <Layers className="w-3.5 h-3.5" /> View Modules
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => openEditCourse(course)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => handleDeleteCourse(course.id, course.name)}
                        disabled={deletingCourse === course.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                      >
                        {deletingCourse === course.id
                          ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <X className="w-3.5 h-3.5" />}
                        Delete
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {courses.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 text-lg">No courses yet</p>
              <p className="text-white/30 text-sm mt-1">Create your first course to get started</p>
            </div>
          )}
        </>
      ) : (
        /* ── Module List View (Course Detail) ── */
        <>
          <div className="flex items-center gap-3 mb-2">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleBackToCourses}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Courses
            </motion.button>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {selectedCourse.posterUrl ? (
                <img src={selectedCourse.posterUrl} alt={selectedCourse.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shrink-0">
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-white">{selectedCourse.name}</h3>
                <p className="text-sm text-white/50 mt-0.5">
                  {courseModules.length} modules · {selectedCourse._count?.events ?? 0} workshops conducted
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={openCreateModule}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Module
            </motion.button>
          </div>

          {/* Course Staff: Associate Instructors & Volunteers */}
          {(courseStaffLoading || courseStaff) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15">
                <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  Associate Instructors {courseStaff ? `(${courseStaff.associateInstructors?.length || 0})` : ''}
                </p>
                {courseStaffLoading ? (
                  <div className="h-8 w-32 bg-white/5 rounded animate-pulse" />
                ) : courseStaff?.associateInstructors?.length > 0 ? (
                  <div className="space-y-2">
                    {courseStaff.associateInstructors.map((ai: any) => (
                      <div key={ai.id} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                          {ai.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate">{ai.name}</p>
                          {ai.department !== '—' && <p className="text-white/40 text-[10px] truncate">{ai.department}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/30 text-xs">None assigned</p>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/15">
                <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  Volunteers {courseStaff ? `(${courseStaff.volunteers?.length || 0})` : ''}
                </p>
                {courseStaffLoading ? (
                  <div className="h-8 w-32 bg-white/5 rounded animate-pulse" />
                ) : courseStaff?.volunteers?.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {courseStaff.volunteers.map((v: any) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate">{v.name}</p>
                          <p className="text-white/40 text-[10px] font-mono truncate">{v.rollNo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/30 text-xs">None assigned</p>
                )}
              </div>
            </div>
          )}

          {loadingModules ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {courseModules.map((mod, idx) => (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10 hover:border-primary/20 transition-all"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 text-white/60 font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white">{mod.title}</h4>
                        {mod.description && <p className="text-xs text-white/50 mt-1">{mod.description}</p>}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/40">
                          {mod.duration && <span>Duration: {mod.duration}</span>}
                          {(mod.quizLink || mod.postQuizLink) && (
                            <a href={mod.quizLink || mod.postQuizLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                              <Link2 className="w-3 h-3" /> Quiz{mod.quizLink && mod.postQuizLink ? ' (Pre)' : ''}
                            </a>
                          )}
                          {mod.quizLink && mod.postQuizLink && (
                            <a href={mod.postQuizLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                              <Link2 className="w-3 h-3" /> Quiz (Post)
                            </a>
                          )}
                          {mod.feedbackLink && (
                            <a href={mod.feedbackLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-teal-400 hover:text-teal-300">
                              <ClipboardList className="w-3 h-3" /> Feedback
                            </a>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="text-primary font-semibold">{mod._count?.events ?? 0}</span> workshops
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <motion.button
                          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          onClick={() => handleCreateWorkshopFromModule(mod)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                        >
                          <Plus className="w-3 h-3" /> Workshop
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          onClick={() => openEditModule(mod)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-all"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          onClick={() => handleDeleteModule(mod.id, mod.title)}
                          disabled={deletingModule === mod.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          {deletingModule === mod.id
                            ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                            : <X className="w-3 h-3" />}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {courseModules.length === 0 && (
                <div className="text-center py-10">
                  <Layers className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">No modules yet</p>
                  <p className="text-white/30 text-sm mt-1">Add your first module to this course</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
