import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { getDatabase } from '../../database/connection';
import { encryptPII, decryptPII, hashForIndex } from '../../utils/encryption';
import { NotFoundError } from '../../utils/errors';
import { PaginatedResult, UUID } from '../../types';
import { CreateHCPInput, UpdateHCPInput, ListHCPsQuery, CreateConsentInput } from './hcp.schema';
import { logger } from '../../utils/logger';

export interface HCPRecord {
  id: UUID;
  externalId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialty: string;
  subSpecialty?: string;
  influenceLevel: string;
  primaryInstitutionId?: UUID;
  territoryId?: UUID;
  title?: string;
  yearsOfPractice?: number;
  languages: string[];
  therapeuticAreas: string[];
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transforms a raw DB row (encrypted PII fields) into a decrypted HCP record.
 */
function decryptHCPRow(row: Record<string, unknown>): HCPRecord {
  return {
    id: row.id as string,
    externalId: row.external_id as string | undefined,
    firstName: decryptPII(row.first_name_encrypted as string),
    lastName: decryptPII(row.last_name_encrypted as string),
    email: row.email_encrypted ? decryptPII(row.email_encrypted as string) : undefined,
    phone: row.phone_encrypted ? decryptPII(row.phone_encrypted as string) : undefined,
    specialty: row.specialty as string,
    subSpecialty: row.sub_specialty as string | undefined,
    influenceLevel: row.influence_level as string,
    primaryInstitutionId: row.primary_institution_id as string | undefined,
    territoryId: row.territory_id as string | undefined,
    title: row.title as string | undefined,
    yearsOfPractice: row.years_of_practice as number | undefined,
    languages: (row.languages as string[]) || [],
    therapeuticAreas: (row.therapeutic_areas as string[]) || [],
    metadata: (row.metadata as Record<string, unknown>) || {},
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class HCPService {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  async create(input: CreateHCPInput): Promise<HCPRecord> {
    const id = uuidv4();

    const record = {
      id,
      external_id: input.externalId,
      first_name_encrypted: encryptPII(input.firstName),
      first_name_hash: hashForIndex(input.firstName.toLowerCase()),
      last_name_encrypted: encryptPII(input.lastName),
      last_name_hash: hashForIndex(input.lastName.toLowerCase()),
      email_encrypted: input.email ? encryptPII(input.email) : null,
      email_hash: input.email ? hashForIndex(input.email.toLowerCase()) : null,
      phone_encrypted: input.phone ? encryptPII(input.phone) : null,
      phone_hash: input.phone ? hashForIndex(input.phone) : null,
      specialty: input.specialty,
      sub_specialty: input.subSpecialty,
      influence_level: input.influenceLevel,
      primary_institution_id: input.primaryInstitutionId,
      territory_id: input.territoryId,
      title: input.title,
      years_of_practice: input.yearsOfPractice,
      languages: JSON.stringify(input.languages || []),
      therapeutic_areas: JSON.stringify(input.therapeuticAreas || []),
      metadata: JSON.stringify(input.metadata || {}),
      is_active: true,
    };

    await this.db('hcps').insert(record);
    logger.info('HCP created', { hcpId: id, specialty: input.specialty });

    return this.getById(id);
  }

  async getById(id: UUID): Promise<HCPRecord> {
    const row = await this.db('hcps').where({ id, deleted_at: null }).first();
    if (!row) {
      throw new NotFoundError('HCP', id);
    }
    return decryptHCPRow(row);
  }

  async update(id: UUID, input: UpdateHCPInput): Promise<HCPRecord> {
    const existing = await this.db('hcps').where({ id, deleted_at: null }).first();
    if (!existing) {
      throw new NotFoundError('HCP', id);
    }

    const updates: Record<string, unknown> = { updated_at: new Date() };

    if (input.firstName !== undefined) {
      updates.first_name_encrypted = encryptPII(input.firstName);
      updates.first_name_hash = hashForIndex(input.firstName.toLowerCase());
    }
    if (input.lastName !== undefined) {
      updates.last_name_encrypted = encryptPII(input.lastName);
      updates.last_name_hash = hashForIndex(input.lastName.toLowerCase());
    }
    if (input.email !== undefined) {
      updates.email_encrypted = input.email ? encryptPII(input.email) : null;
      updates.email_hash = input.email ? hashForIndex(input.email.toLowerCase()) : null;
    }
    if (input.phone !== undefined) {
      updates.phone_encrypted = input.phone ? encryptPII(input.phone) : null;
      updates.phone_hash = input.phone ? hashForIndex(input.phone) : null;
    }
    if (input.specialty !== undefined) updates.specialty = input.specialty;
    if (input.subSpecialty !== undefined) updates.sub_specialty = input.subSpecialty;
    if (input.influenceLevel !== undefined) updates.influence_level = input.influenceLevel;
    if (input.primaryInstitutionId !== undefined) updates.primary_institution_id = input.primaryInstitutionId;
    if (input.territoryId !== undefined) updates.territory_id = input.territoryId;
    if (input.title !== undefined) updates.title = input.title;
    if (input.yearsOfPractice !== undefined) updates.years_of_practice = input.yearsOfPractice;
    if (input.languages !== undefined) updates.languages = JSON.stringify(input.languages);
    if (input.therapeuticAreas !== undefined) updates.therapeutic_areas = JSON.stringify(input.therapeuticAreas);
    if (input.metadata !== undefined) updates.metadata = JSON.stringify(input.metadata);

    await this.db('hcps').where({ id }).update(updates);
    logger.info('HCP updated', { hcpId: id });

    return this.getById(id);
  }

  async list(query: ListHCPsQuery, territoryFilter?: UUID[]): Promise<PaginatedResult<HCPRecord>> {
    const qb = this.db('hcps').where({ deleted_at: null });

    // Territory scoping
    if (territoryFilter && territoryFilter.length > 0) {
      qb.whereIn('territory_id', territoryFilter);
    }

    // Filters
    if (query.specialty) qb.where('specialty', query.specialty);
    if (query.influenceLevel) qb.where('influence_level', query.influenceLevel);
    if (query.territoryId) qb.where('territory_id', query.territoryId);
    if (query.institutionId) qb.where('primary_institution_id', query.institutionId);
    if (query.isActive !== undefined) qb.where('is_active', query.isActive);

    // Segment filter
    if (query.segmentId) {
      qb.whereIn('id', function () {
        this.select('hcp_id').from('hcp_segments').where('segment_id', query.segmentId);
      });
    }

    // Search by name hash (encrypted field lookup)
    if (query.search) {
      const searchHash = hashForIndex(query.search.toLowerCase());
      qb.where(function () {
        this.where('first_name_hash', searchHash)
          .orWhere('last_name_hash', searchHash)
          .orWhere('email_hash', searchHash)
          .orWhere('external_id', 'ilike', `%${query.search}%`);
      });
    }

    // Count total
    const [{ count }] = await qb.clone().count('* as count');
    const total = Number(count);

    // Sort and paginate
    const sortColumn = query.sortBy === 'last_name' ? 'last_name_hash' : query.sortBy;
    const rows = await qb
      .orderBy(sortColumn, query.sortOrder)
      .offset((query.page - 1) * query.limit)
      .limit(query.limit);

    return {
      data: rows.map(decryptHCPRow),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async softDelete(id: UUID): Promise<void> {
    const existing = await this.db('hcps').where({ id, deleted_at: null }).first();
    if (!existing) {
      throw new NotFoundError('HCP', id);
    }
    await this.db('hcps').where({ id }).update({ deleted_at: new Date(), is_active: false });
    logger.info('HCP soft-deleted', { hcpId: id });
  }

  /**
   * GDPR right-to-erasure: anonymize PII but preserve record for audit integrity.
   */
  async anonymize(id: UUID): Promise<void> {
    const existing = await this.db('hcps').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('HCP', id);
    }

    await this.db('hcps').where({ id }).update({
      first_name_encrypted: encryptPII('[ANONYMIZED]'),
      first_name_hash: hashForIndex('[ANONYMIZED]'),
      last_name_encrypted: encryptPII('[ANONYMIZED]'),
      last_name_hash: hashForIndex('[ANONYMIZED]'),
      email_encrypted: null,
      email_hash: null,
      phone_encrypted: null,
      phone_hash: null,
      external_id: null,
      is_active: false,
      deleted_at: new Date(),
      metadata: JSON.stringify({ anonymized: true, anonymized_at: new Date().toISOString() }),
    });

    logger.info('HCP anonymized (GDPR erasure)', { hcpId: id });
  }

  async getInteractionHistory(hcpId: UUID): Promise<Record<string, unknown>[]> {
    return this.db('interactions')
      .where({ hcp_id: hcpId })
      .orderBy('created_at', 'desc')
      .limit(50);
  }

  async getConsentStatus(hcpId: UUID): Promise<Record<string, unknown>[]> {
    // Get latest consent per type
    return this.db('consents')
      .where({ hcp_id: hcpId })
      .distinctOn('consent_type')
      .orderBy(['consent_type', { column: 'created_at', order: 'desc' }]);
  }

  async recordConsent(input: CreateConsentInput, recordedBy: UUID): Promise<Record<string, unknown>> {
    const id = uuidv4();
    const record = {
      id,
      hcp_id: input.hcpId,
      consent_type: input.consentType,
      status: input.status,
      granted_at: input.status === 'granted' ? new Date() : null,
      revoked_at: input.status === 'revoked' ? new Date() : null,
      expires_at: input.expiresAt || null,
      source: input.source,
      evidence_url: input.evidenceUrl,
      recorded_by: recordedBy,
      notes: input.notes,
    };

    await this.db('consents').insert(record);
    logger.info('Consent recorded', {
      hcpId: input.hcpId,
      consentType: input.consentType,
      status: input.status,
    });

    return record;
  }

  async getAIScores(hcpId: UUID): Promise<Record<string, unknown>[]> {
    return this.db('ai_scores')
      .where({ hcp_id: hcpId })
      .orderBy('computed_at', 'desc')
      .limit(10);
  }
}
