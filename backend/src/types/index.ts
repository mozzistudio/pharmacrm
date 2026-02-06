// ─── Common Types ──────────────────────────────────────────────

export type UUID = string;
export type ISODateTime = string;

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

// ─── User & Auth Types ─────────────────────────────────────────

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  FIELD_REP = 'field_rep',
  MEDICAL_AFFAIRS = 'medical_affairs',
  MARKETING = 'marketing',
  COMPLIANCE_OFFICER = 'compliance_officer',
  READ_ONLY = 'read_only',
}

export interface AuthenticatedUser {
  id: UUID;
  email: string;
  role: UserRole;
  territoryIds: UUID[];
  permissions: string[];
}

export interface JWTPayload {
  userId: UUID;
  email: string;
  role: UserRole;
  territoryIds: UUID[];
  iat?: number;
  exp?: number;
}

// ─── HCP Types ─────────────────────────────────────────────────

export enum HCPSpecialty {
  CARDIOLOGY = 'cardiology',
  ONCOLOGY = 'oncology',
  NEUROLOGY = 'neurology',
  ENDOCRINOLOGY = 'endocrinology',
  PULMONOLOGY = 'pulmonology',
  RHEUMATOLOGY = 'rheumatology',
  GASTROENTEROLOGY = 'gastroenterology',
  DERMATOLOGY = 'dermatology',
  PSYCHIATRY = 'psychiatry',
  GENERAL_PRACTICE = 'general_practice',
  INTERNAL_MEDICINE = 'internal_medicine',
  PEDIATRICS = 'pediatrics',
  OTHER = 'other',
}

export enum InfluenceLevel {
  KEY_OPINION_LEADER = 'key_opinion_leader',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum ConsentStatus {
  GRANTED = 'granted',
  REVOKED = 'revoked',
  PENDING = 'pending',
  EXPIRED = 'expired',
}

export enum ConsentType {
  EMAIL = 'email',
  PHONE = 'phone',
  VISIT = 'visit',
  REMOTE_DETAILING = 'remote_detailing',
  DATA_PROCESSING = 'data_processing',
  MARKETING = 'marketing',
}

// ─── Engagement Types ──────────────────────────────────────────

export enum ChannelType {
  EMAIL = 'email',
  PHONE = 'phone',
  IN_PERSON_VISIT = 'in_person_visit',
  REMOTE_DETAILING = 'remote_detailing',
  CONFERENCE = 'conference',
  WEBINAR = 'webinar',
}

export enum InteractionStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum TaskPriority {
  URGENT = 'urgent',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

// ─── AI Types ──────────────────────────────────────────────────

export interface AIScoreResult {
  hcpId: UUID;
  scoreType: 'engagement_likelihood' | 'prescription_propensity';
  score: number; // 0-100
  confidence: number; // 0-1
  factors: AIScoreFactor[];
  modelVersion: string;
  computedAt: ISODateTime;
}

export interface AIScoreFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

export interface NextBestAction {
  hcpId: UUID;
  recommendedChannel: ChannelType;
  recommendedTiming: ISODateTime;
  suggestedContent: string;
  reasoning: string;
  confidence: number;
  factors: AIScoreFactor[];
  modelVersion: string;
}

export interface AISummary {
  entityId: UUID;
  entityType: 'hcp' | 'territory' | 'campaign';
  summary: string;
  keyInsights: string[];
  generatedAt: ISODateTime;
  modelVersion: string;
  inputDataHash: string;
}

// ─── Audit Types ───────────────────────────────────────────────

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  EXPORT = 'export',
  LOGIN = 'login',
  LOGOUT = 'logout',
  CONSENT_CHANGE = 'consent_change',
  AI_DECISION = 'ai_decision',
}

export interface AuditEntry {
  id: UUID;
  userId: UUID;
  action: AuditAction;
  entityType: string;
  entityId: UUID;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: ISODateTime;
  metadata?: Record<string, unknown>;
}

// ─── Analytics Types ───────────────────────────────────────────

export interface KPI {
  name: string;
  value: number;
  unit: string;
  period: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export interface DashboardData {
  kpis: KPI[];
  territoryPerformance: TerritoryMetric[];
  engagementTrends: TimeSeriesData[];
  topHCPs: HCPRanking[];
}

export interface TerritoryMetric {
  territoryId: UUID;
  territoryName: string;
  totalHCPs: number;
  totalInteractions: number;
  avgEngagementScore: number;
  reachRate: number;
  period: string;
}

export interface TimeSeriesData {
  timestamp: ISODateTime;
  value: number;
  label: string;
}

export interface HCPRanking {
  hcpId: UUID;
  name: string;
  specialty: HCPSpecialty;
  engagementScore: number;
  interactionCount: number;
  rank: number;
}
