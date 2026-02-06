// ─── API Response Types ────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Auth Types ────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  territoryIds: string[];
}

export type UserRole =
  | 'admin'
  | 'manager'
  | 'field_rep'
  | 'medical_affairs'
  | 'marketing'
  | 'compliance_officer'
  | 'read_only';

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

// ─── HCP Types ─────────────────────────────────────────────────

export interface HCP {
  id: string;
  externalId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialty: string;
  subSpecialty?: string;
  influenceLevel: string;
  primaryInstitutionId?: string;
  territoryId?: string;
  title?: string;
  yearsOfPractice?: number;
  languages: string[];
  therapeuticAreas: string[];
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Consent {
  id: string;
  hcpId: string;
  consentType: string;
  status: 'granted' | 'revoked' | 'pending' | 'expired';
  grantedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  source?: string;
  createdAt: string;
}

// ─── Engagement Types ──────────────────────────────────────────

export interface Interaction {
  id: string;
  hcpId: string;
  userId: string;
  channel: string;
  status: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  aiSummary?: string;
  sentimentScore?: number;
  productsDiscussed: string[];
  keyMessages: string[];
  createdAt: string;
}

export interface Task {
  id: string;
  assignedTo: string;
  createdBy: string;
  hcpId?: string;
  title: string;
  description?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  dueDate: string;
  source: 'manual' | 'ai_recommended' | 'system';
  createdAt: string;
}

// ─── AI Types ──────────────────────────────────────────────────

export interface AIScore {
  hcpId: string;
  scoreType: string;
  score: number;
  confidence: number;
  factors: Array<{
    name: string;
    weight: number;
    value: number;
    description: string;
  }>;
  modelVersion: string;
  computedAt: string;
}

export interface NextBestAction {
  id: string;
  hcpId: string;
  recommendedChannel: string;
  recommendedTiming: string;
  suggestedContent: string;
  reasoning: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
}

// ─── Analytics Types ───────────────────────────────────────────

export interface DashboardData {
  kpis: Array<{
    name: string;
    value: number;
    unit: string;
    period: string;
  }>;
  channelBreakdown: Record<string, number>;
  topHCPs: Array<Record<string, unknown>>;
  recentActivity: Array<Record<string, unknown>>;
}

// ─── Field Force Types ─────────────────────────────────────────

export interface VisitPlan {
  id: string;
  userId: string;
  planDate: string;
  status: string;
  totalVisits: number;
  items: VisitPlanItem[];
}

export interface VisitPlanItem {
  id: string;
  hcpId: string;
  sequenceOrder: number;
  priority: string;
  objective?: string;
}
