// Backend API bilan bir xil shakldagi (shape) tiplar.
// /mobile va /admin ikkalasi ham shu fayldan foydalanadi - backend javobi o'zgarsa,
// shu yerni yangilash kifoya.

export interface User {
  id: string;
  phone: string;
  name: string | null;
  examDate: string | null; // ISO sana
  isPremium: boolean;
  premiumExpiresAt: string | null;
  referralCode: string;
  referredByCode: string | null;
  walletBalance: number;
  createdAt: string;
  streak?: Streak | null;
}

export interface Streak {
  currentCount: number;
  lastActiveDate: string | null;
}
export interface DashboardData {
  examsTaken: number;
  examsGoal: number;
  streakCurrent: number;
  streakLongest: number;
}

export interface LessonSummary {
  id: string;
  title: string;
  order: number;
}

export interface Week {
  id: string;
  title: string;
  order: number;
  lessons: LessonSummary[];
}

export interface CourseModule {
  id: string;
  title: string;
  order: number;
  weeks: Week[];
}

export interface QuestionForUser {
  id: string;
  text: string;
  options: string[];
  // correctIndex va explanation shu yerda YO'Q - javob berilgunga qadar backend qaytarmaydi
}

export interface LessonDetail {
  id: string;
  weekId: string;
  title: string;
  content: string;
  order: number;
  questions: QuestionForUser[];
}

export interface SubmitAnswerResult {
  isCorrect: boolean;
  correctIndex: number;
  explanation: string;
}

export interface FreeQuota {
  isPremium: boolean;
  remainingToday: number | null;
}

export interface RequestOtpResponse {
  message: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  isNewUser: boolean;
}

export interface AiFocusArea {
  topic: string;
  reason: string;
  suggestion: string;
}

export interface AiStudyPlanItem {
  label: string;
  focus: string;
}

export type ExamReadiness = 'past_due' | 'behind' | 'on_track' | 'ahead' | 'unknown';

export interface AiRecommendation {
  summary: string;
  focusAreas: AiFocusArea[];
  studyPlan: AiStudyPlanItem[];
  motivation: string;
  examReadiness: ExamReadiness;
  generatedAt: string;
  cached: boolean;
  throttled: boolean;
}

// Backend xato javobi (NestJS standart formatida)
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  code?: string;
  error?: string;
}
export type QuestionType = 'CLOSED' | 'OPEN';
export type ExamSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';

export interface ExamQuestion {
  answerId: string;
  questionId: string;
  questionType: QuestionType;
  text: string;
  options?: string[];
  partAPrompt?: string;
  partBPrompt?: string;
  savedChosenIndex: number | null;
  savedPartAText: string | null;
  savedPartBText: string | null;
}

export interface ExamSessionPayload {
  sessionId: string;
  status: ExamSessionStatus;
  startedAt: string;
  expiresAt: string;
  totalQuestions: number;
  questions: ExamQuestion[];
}

export interface ExamResult {
  sessionId: string;
  status: ExamSessionStatus;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  grade: string | null;
  closedCorrect: number;
  closedTotal: number;
  openFullyCorrect: number;
  openTotal: number;
  review: ExamReviewItem[];
}

export interface ExamReviewItem {
  questionText: string;
  questionType: QuestionType;
  chosenIndex: number | null;
  correctIndex?: number;
  explanation?: string;
  partAText: string | null;
  partACorrect: boolean | null;
  partBText: string | null;
  partBCorrect: boolean | null;
  pointsEarned: number;
}

export interface ExamHistoryItem {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  grade: string | null;
  status: ExamSessionStatus;
  
}
export interface SaveExamAnswerDto {
  chosenIndex?: number;
  partAText?: string;
  partBText?: string;
}