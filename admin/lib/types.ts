export type AdminUser = {
  id: string;
  name: string | null;
  phone: string;
  avatarUrl: string | null;
  isPremium: boolean;
  isPremiumActive: boolean;
  premiumExpiresAt: string | null;
  walletBalance: number;
  examDate: string | null;
  createdAt: string;
  streak: number;
};

export type UsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminStats = {
  totalUsers: number;
  activePremium: number;
  freeUsers: number;
  newUsersToday: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  totalRevenue: number;
};

// ---- Bozor (marketplace) admin tiplari ----
export type TeacherQueueItem = { id: string; name: string | null; headline: string; submittedAt: string | null; status: string; credentialCount: number };

export type TeacherDetail = {
  id: string;
  name: string | null;
  email: string;
  headline: string;
  bio: string;
  subjects: string[];
  levels: string[];
  languages: string[];
  priceMinor: number;
  introVideoUrl: string | null;
  verificationStatus: string;
  rejectionReason: string | null;
  credentials: { id: string; kind: string; title: string; status: string; reviewNote: string | null; fileId?: string }[];
};

export type ReportItem = {
  id: string;
  targetType: 'REVIEW' | 'USER' | 'MESSAGE';
  targetId: string;
  reason: string;
  note: string;
  status: string;
  createdAt: string;
  target: unknown;
};

export type PeopleResponse = {
  total: number;
  items: { id: string; name: string | null; email: string; role: string; status: string; createdAt: string; teacherProfileId: string | null; verificationStatus: string | null }[];
};
