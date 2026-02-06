import { z } from 'zod';

export const createInteractionSchema = z.object({
  hcpId: z.string().uuid(),
  channel: z.enum([
    'email', 'phone', 'in_person_visit',
    'remote_detailing', 'conference', 'webinar',
  ]),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled', 'no_show']).default('planned'),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
  notes: z.string().optional(),
  productsDiscussed: z.array(z.string().uuid()).optional(),
  keyMessages: z.array(z.string()).optional(),
  samplesDelivered: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }).optional(),
  parentInteractionId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateInteractionSchema = z.object({
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
  notes: z.string().optional(),
  productsDiscussed: z.array(z.string().uuid()).optional(),
  keyMessages: z.array(z.string()).optional(),
  samplesDelivered: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
  sentimentScore: z.number().min(-1).max(1).optional(),
  aiSummary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createTaskSchema = z.object({
  assignedTo: z.string().uuid(),
  hcpId: z.string().uuid().optional(),
  interactionId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  dueDate: z.string().datetime(),
  source: z.enum(['manual', 'ai_recommended', 'system']).default('manual'),
  metadata: z.record(z.unknown()).optional(),
});

export const updateTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'overdue', 'cancelled']).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  dueDate: z.string().datetime().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listInteractionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  hcpId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  channel: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['scheduled_at', 'created_at', 'status']).default('scheduled_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;
export type UpdateInteractionInput = z.infer<typeof updateInteractionSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
