import { z } from 'zod';

export const createHCPSchema = z.object({
  externalId: z.string().max(100).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  specialty: z.enum([
    'cardiology', 'oncology', 'neurology', 'endocrinology',
    'pulmonology', 'rheumatology', 'gastroenterology', 'dermatology',
    'psychiatry', 'general_practice', 'internal_medicine', 'pediatrics', 'other',
  ]),
  subSpecialty: z.string().max(100).optional(),
  influenceLevel: z.enum(['key_opinion_leader', 'high', 'medium', 'low']),
  primaryInstitutionId: z.string().uuid().optional(),
  territoryId: z.string().uuid().optional(),
  title: z.string().max(50).optional(),
  yearsOfPractice: z.number().int().min(0).max(70).optional(),
  languages: z.array(z.string()).optional(),
  therapeuticAreas: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateHCPSchema = createHCPSchema.partial();

export const listHCPsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['last_name', 'specialty', 'influence_level', 'created_at']).default('last_name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  specialty: z.string().optional(),
  influenceLevel: z.string().optional(),
  territoryId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
  segmentId: z.string().uuid().optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createConsentSchema = z.object({
  hcpId: z.string().uuid(),
  consentType: z.enum([
    'email', 'phone', 'visit', 'remote_detailing',
    'data_processing', 'marketing',
  ]),
  status: z.enum(['granted', 'revoked', 'pending', 'expired']),
  expiresAt: z.string().datetime().optional(),
  source: z.string().optional(),
  evidenceUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['manual', 'ai_driven', 'rule_based']),
  criteria: z.record(z.unknown()).optional(),
});

export type CreateHCPInput = z.infer<typeof createHCPSchema>;
export type UpdateHCPInput = z.infer<typeof updateHCPSchema>;
export type ListHCPsQuery = z.infer<typeof listHCPsQuerySchema>;
export type CreateConsentInput = z.infer<typeof createConsentSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
