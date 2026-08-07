export type UserRole = 'student' | 'instructor' | 'admin' | 'volunteer' | 'associate-instructor';

export type Programme = 'BTech' | 'B.Des' | 'MTech' | 'PhD' | 'MSc' | 'Staff' | 'Dual Degree';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}

export interface CompletedEvent {
  eventId: string;
  title: string;
  date: string;
  venue: string;
  role?: string;
  instructorName?: string;
  engagementType?: 'VOLUNTEERING' | 'ATTENDING';
  marks?: number;
  maxMarks?: number;
  starRating?: number;
}

export interface Student extends User {
  role: 'student';
  rollNo: string;
  department: string;
  year: number;
  batch: string;
  programme: Programme;
  registeredEvents: string[];
  completedEvents: CompletedEvent[];
}

export interface Instructor extends User {
  role: 'instructor';
  empId: string;
  department: string;
  specialization: string;
  sessions: Session[];
  totalStudents: number;
}

export interface AssociateInstructor extends User {
  role: 'associate-instructor';
  empId: string;
  department: string;
  assignedSessions: string[];
}

export interface Admin extends User {
  role: 'admin';
  empId: string;
  permissions: string[];
}

export interface Volunteer extends User {
  role: 'volunteer';
  rollNo: string;
  department: string;
  year: number;
  batch: string;
  programme: Programme;
  registeredEvents: string[];
  completedEvents: CompletedEvent[];
  eventsVolunteered: number;
  eventsCompleted: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  mode: 'Online' | 'Offline';
  capacity: number;
  registeredCount: number;
  status: 'published' | 'completed' | 'draft' | 'cancelled';
  organizer: string;
  volunteerSlots?: number;
}

export interface Session {
  id: string;
  title: string;
  instructorId: string;
  instructorName: string;
  date: string;
  time: string;
  venue: string;
  mode: 'Online' | 'Offline';
  participantCount: number;
  actualAttendees?: number;
  status: 'upcoming' | 'completed';
  registrants: string[];
}

export interface Notification {
  id: string;
  type: 'reminder' | 'general';
  message: string;
  time: string;
  read: boolean;
}

export interface MemberDirectory {
  id: string;
  name: string;
  email: string;
  rollNo?: string;
  empId?: string;
  department: string;
  year?: number;
  batch?: string;
  programme: Programme;
  role: UserRole;
  status?: 'active' | 'inactive';
}

export interface VolunteerPool {
  id: string;
  name: string;
  rollNo: string;
  department: string;
  year: number;
  eventId: string;
  available: boolean;
  selected: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  sessionId: string;
  date: string;
  status: 'present' | 'absent';
}

export interface QuizSession {
  sessionId: string;
  sessionTitle: string;
  quizActive: boolean;
  feedbackActive: boolean;
  registrantCount: number;
}

export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';

// Admin-authoring shape for one of the fixed 10 in-built quiz questions
// (on a CourseModule or a standalone Event) — correctOption is only ever
// sent to/from the admin endpoints, never to the student-facing quiz.
export interface QuizQuestionForm {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: QuizOptionKey;
}

// One quiz from the reusable Forms library (GET /quiz-library). A quiz can be
// linked to many CourseModules and/or Events at once — _count reflects how
// widely it's currently in use, shown as a usage badge in the Forms tab.
export interface QuizLibraryItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  questions?: QuizQuestionForm[];
  _count?: { questions: number; courseModules: number; events: number };
}

// Student-facing question shape — no correctOption, the answer key is
// stripped server-side before this ever reaches the client.
export interface QuizStudentQuestion {
  id: string;
  order: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export interface QuizStudentView {
  available: boolean;
  locked?: boolean;
  alreadySubmitted?: boolean;
  score?: number | null;
  maxScore?: number;
  questions?: QuizStudentQuestion[];
}

// Feedback library — same reference architecture as Quiz above, but with
// flexible-length, mixed-type questions and no scoring/correct-option.
export type FeedbackQuestionType = 'TEXT' | 'RATING' | 'MCQ';

export interface FeedbackQuestionForm {
  questionText: string;
  type: FeedbackQuestionType;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
}

// One form from the reusable Forms library (GET /feedback-library).
export interface FeedbackLibraryItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  questions?: FeedbackQuestionForm[];
  _count?: { questions: number; courseModules: number; events: number };
}

export interface FeedbackStudentQuestion {
  id: string;
  order: number;
  questionText: string;
  type: FeedbackQuestionType;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
}

export interface FeedbackStudentAnswer {
  questionId: string;
  answerText?: string;
  answerRating?: number;
}

export interface FeedbackFormStudentView {
  available: boolean;
  locked?: boolean;
  alreadySubmitted?: boolean;
  questions?: FeedbackStudentQuestion[];
  answers?: FeedbackStudentAnswer[];
}

export interface StudentModule {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  status: 'completed' | 'pending' | 'in-progress';
  marks?: number;
  maxMarks?: number;
  completedDate?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  venue?: string;
  duration: number;
}

export interface AuthPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  rollNo?: string;
  empId?: string;
  department?: string;
  year?: number;
  batch?: string;
  programme?: Programme;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  interests?: string;
  iat: number;
}

export type AnalyticsAttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'NOT_MARKED';

// One student's participation in one workshop row — the nested shape returned
// per-entry inside WorkshopAnalyticsRow.students[].
export interface AnalyticsStudentEntry {
  userId: string;
  name: string;
  email: string;
  rollNo: string;
  batch: string;
  department: string | null;
  programme: string | null;
  attendanceStatus: AnalyticsAttendanceStatus;
  // Self check-in exists (PENDING or VERIFIED) — lets the UI tell "checked
  // in, awaiting instructor review" apart from "never checked in at all";
  // both are otherwise indistinguishable since neither has an AttendanceRecord
  // and so both fall back to attendanceStatus NOT_MARKED.
  hasCheckedIn: boolean;
  quizCompleted: boolean;
  score: number | null;
  maxScore: number | null;
  // Raw score (always out of 10) from the in-built MCQ quiz specifically —
  // distinct from score/maxScore above, which sum across ALL of the event's
  // modules (including the legacy Google-Form quiz webhook's module). Null
  // if this student has no in-built-quiz submission for this event.
  quizScore: number | null;
  rating: number | null;
  registrationStatus: string;
}

// One row from GET /admin/analytics/workshops — one row per completed workshop.
export interface WorkshopAnalyticsRow {
  id: string;
  workshopName: string;
  courseName: string;
  // Whether this row's course has quiz-based Pass/Fail grading enabled
  // (Course.hasQuiz) — set by admins on the course template, separate from
  // isCompulsory. Drives whether a student's quizScore can produce "Fail".
  courseHasQuiz: boolean;
  moduleName: string;
  instructorName: string;
  instructorId: string | null;
  associateInstructorName: string;
  associateInstructorId: string | null;
  volunteerNames: string[];
  date: string;
  endAt: string;
  batch: string;
  venue: string;
  totalRegistered: number;
  totalAttended: number;
  totalAbsent: number;
  avgRating: string | null;
  students: AnalyticsStudentEntry[];
}

export interface AnalyticsFilterState {
  course: string;
  topic: string;
  instructor: string;
  batch: string;
  dateFrom: string;
  dateTo: string;
  attendanceStatus: string;
  department: string;
  minScorePct: string;
  maxScorePct: string;
}
