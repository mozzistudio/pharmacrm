import { Knex } from 'knex';

/**
 * PharmaCRM Initial Schema
 *
 * Creates all core tables with:
 * - UUID primary keys
 * - Timestamp tracking (created_at, updated_at)
 * - Soft deletes where appropriate
 * - Indexes for common query patterns
 * - Foreign key constraints
 */
export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // ─── USERS & AUTH ────────────────────────────────────────────

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.string('first_name', 100).notNullable();
    t.string('last_name', 100).notNullable();
    t.enum('role', [
      'admin', 'manager', 'field_rep', 'medical_affairs',
      'marketing', 'compliance_officer', 'read_only',
    ]).notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('last_login_at');
    t.jsonb('preferences').defaultTo('{}');
    t.timestamps(true, true);
    t.timestamp('deleted_at');
  });

  await knex.schema.createTable('permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 100).notNullable().unique();
    t.string('module', 50).notNullable();
    t.string('action', 50).notNullable();
    t.text('description');
  });

  await knex.schema.createTable('role_permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('role', 50).notNullable();
    t.uuid('permission_id').notNullable().references('id').inTable('permissions');
    t.unique(['role', 'permission_id']);
  });

  // ─── TERRITORIES ─────────────────────────────────────────────

  await knex.schema.createTable('territories', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 200).notNullable();
    t.string('code', 50).notNullable().unique();
    t.uuid('parent_id').references('id').inTable('territories');
    t.string('region', 100);
    t.string('country', 100).notNullable();
    t.jsonb('boundaries'); // GeoJSON if needed
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('user_territories', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.uuid('territory_id').notNullable().references('id').inTable('territories');
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.unique(['user_id', 'territory_id']);
  });

  // ─── INSTITUTIONS ────────────────────────────────────────────

  await knex.schema.createTable('institutions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 300).notNullable();
    t.string('type', 50).notNullable(); // hospital, clinic, pharmacy, university
    t.text('address_encrypted'); // PII - encrypted at rest
    t.string('address_hash', 64); // for lookup
    t.string('city', 100);
    t.string('state', 100);
    t.string('country', 100);
    t.string('postal_code', 20);
    t.string('phone_encrypted'); // PII
    t.string('phone_hash', 64);
    t.uuid('territory_id').references('id').inTable('territories');
    t.integer('bed_count');
    t.boolean('is_academic').defaultTo(false);
    t.jsonb('metadata').defaultTo('{}');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.index('territory_id');
    t.index('type');
  });

  // ─── HCP PROFILES ───────────────────────────────────────────

  await knex.schema.createTable('hcps', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('external_id', 100).unique(); // NPI or equivalent
    t.string('first_name_encrypted').notNullable(); // PII
    t.string('first_name_hash', 64).notNullable();
    t.string('last_name_encrypted').notNullable(); // PII
    t.string('last_name_hash', 64).notNullable();
    t.string('email_encrypted'); // PII
    t.string('email_hash', 64);
    t.string('phone_encrypted'); // PII
    t.string('phone_hash', 64);
    t.enum('specialty', [
      'cardiology', 'oncology', 'neurology', 'endocrinology',
      'pulmonology', 'rheumatology', 'gastroenterology', 'dermatology',
      'psychiatry', 'general_practice', 'internal_medicine', 'pediatrics', 'other',
    ]).notNullable();
    t.string('sub_specialty', 100);
    t.enum('influence_level', ['key_opinion_leader', 'high', 'medium', 'low']).notNullable();
    t.uuid('primary_institution_id').references('id').inTable('institutions');
    t.uuid('territory_id').references('id').inTable('territories');
    t.string('title', 50); // Dr., Prof., etc.
    t.integer('years_of_practice');
    t.jsonb('languages').defaultTo('[]');
    t.jsonb('therapeutic_areas').defaultTo('[]');
    t.jsonb('publications_count').defaultTo('0');
    t.jsonb('metadata').defaultTo('{}');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.timestamp('deleted_at');

    t.index('specialty');
    t.index('influence_level');
    t.index('territory_id');
    t.index('primary_institution_id');
    t.index('email_hash');
  });

  // ─── HCP SEGMENTATION ───────────────────────────────────────

  await knex.schema.createTable('segments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 200).notNullable();
    t.text('description');
    t.enum('type', ['manual', 'ai_driven', 'rule_based']).notNullable();
    t.jsonb('criteria').defaultTo('{}'); // rules for auto-segmentation
    t.uuid('created_by').notNullable().references('id').inTable('users');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('hcp_segments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('hcp_id').notNullable().references('id').inTable('hcps');
    t.uuid('segment_id').notNullable().references('id').inTable('segments');
    t.enum('assignment_type', ['manual', 'ai', 'rule']).notNullable();
    t.float('confidence_score'); // for AI assignments
    t.timestamps(true, true);
    t.unique(['hcp_id', 'segment_id']);
  });

  // ─── CONSENT MANAGEMENT ──────────────────────────────────────

  await knex.schema.createTable('consents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('hcp_id').notNullable().references('id').inTable('hcps');
    t.enum('consent_type', [
      'email', 'phone', 'visit', 'remote_detailing',
      'data_processing', 'marketing',
    ]).notNullable();
    t.enum('status', ['granted', 'revoked', 'pending', 'expired']).notNullable();
    t.timestamp('granted_at');
    t.timestamp('revoked_at');
    t.timestamp('expires_at');
    t.text('source'); // where consent was collected
    t.text('evidence_url'); // link to signed consent form
    t.uuid('recorded_by').notNullable().references('id').inTable('users');
    t.text('notes');
    // Immutable: no updated_at, only new records
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['hcp_id', 'consent_type']);
    t.index('status');
  });

  // ─── PRODUCTS ────────────────────────────────────────────────

  await knex.schema.createTable('products', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 200).notNullable();
    t.string('brand_name', 200);
    t.string('generic_name', 200);
    t.string('therapeutic_area', 100).notNullable();
    t.text('description');
    t.string('ndc_code', 50);
    t.enum('status', ['active', 'pipeline', 'discontinued']).notNullable();
    t.jsonb('indications').defaultTo('[]');
    t.jsonb('metadata').defaultTo('{}');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // ─── INTERACTIONS / ENGAGEMENTS ──────────────────────────────

  await knex.schema.createTable('interactions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('hcp_id').notNullable().references('id').inTable('hcps');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.enum('channel', [
      'email', 'phone', 'in_person_visit',
      'remote_detailing', 'conference', 'webinar',
    ]).notNullable();
    t.enum('status', [
      'planned', 'in_progress', 'completed', 'cancelled', 'no_show',
    ]).notNullable();
    t.timestamp('scheduled_at');
    t.timestamp('started_at');
    t.timestamp('completed_at');
    t.integer('duration_minutes');
    t.text('notes_encrypted'); // visit notes - PII-adjacent, encrypted
    t.text('ai_summary'); // AI-generated summary
    t.jsonb('products_discussed').defaultTo('[]');
    t.jsonb('key_messages').defaultTo('[]');
    t.jsonb('samples_delivered').defaultTo('[]');
    t.float('sentiment_score'); // AI-derived
    t.jsonb('location'); // { lat, lng, address }
    t.boolean('is_synced').defaultTo(true); // for offline mode
    t.uuid('parent_interaction_id').references('id').inTable('interactions'); // follow-ups
    t.jsonb('metadata').defaultTo('{}');
    t.timestamps(true, true);

    t.index(['hcp_id', 'channel']);
    t.index(['user_id', 'status']);
    t.index('scheduled_at');
    t.index('status');
  });

  // ─── TASKS & FOLLOW-UPS ─────────────────────────────────────

  await knex.schema.createTable('tasks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('assigned_to').notNullable().references('id').inTable('users');
    t.uuid('created_by').notNullable().references('id').inTable('users');
    t.uuid('hcp_id').references('id').inTable('hcps');
    t.uuid('interaction_id').references('id').inTable('interactions');
    t.string('title', 300).notNullable();
    t.text('description');
    t.enum('priority', ['urgent', 'high', 'medium', 'low']).notNullable();
    t.enum('status', ['pending', 'in_progress', 'completed', 'overdue', 'cancelled']).notNullable();
    t.timestamp('due_date').notNullable();
    t.timestamp('completed_at');
    t.enum('source', ['manual', 'ai_recommended', 'system']).notNullable().defaultTo('manual');
    t.jsonb('metadata').defaultTo('{}');
    t.timestamps(true, true);

    t.index(['assigned_to', 'status']);
    t.index('due_date');
    t.index('hcp_id');
  });

  // ─── EMAIL CAMPAIGNS ────────────────────────────────────────

  await knex.schema.createTable('email_campaigns', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 200).notNullable();
    t.string('subject', 300).notNullable();
    t.text('body_html');
    t.text('body_text');
    t.uuid('segment_id').references('id').inTable('segments');
    t.uuid('product_id').references('id').inTable('products');
    t.enum('status', ['draft', 'scheduled', 'sending', 'sent', 'paused']).notNullable();
    t.timestamp('scheduled_at');
    t.timestamp('sent_at');
    t.uuid('created_by').notNullable().references('id').inTable('users');
    t.uuid('approved_by').references('id').inTable('users');
    t.boolean('compliance_approved').notNullable().defaultTo(false);
    t.jsonb('metadata').defaultTo('{}');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('email_sends', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('campaign_id').notNullable().references('id').inTable('email_campaigns');
    t.uuid('hcp_id').notNullable().references('id').inTable('hcps');
    t.enum('status', ['queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed']).notNullable();
    t.timestamp('sent_at');
    t.timestamp('opened_at');
    t.timestamp('clicked_at');
    t.timestamps(true, true);

    t.index(['campaign_id', 'status']);
    t.index('hcp_id');
  });

  // ─── AI SCORES & PREDICTIONS ─────────────────────────────────

  await knex.schema.createTable('ai_scores', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('hcp_id').notNullable().references('id').inTable('hcps');
    t.enum('score_type', ['engagement_likelihood', 'prescription_propensity']).notNullable();
    t.float('score').notNullable(); // 0-100
    t.float('confidence').notNullable(); // 0-1
    t.jsonb('factors').notNullable().defaultTo('[]'); // explainability
    t.string('model_version', 50).notNullable();
    t.string('input_data_hash', 64).notNullable(); // reproducibility
    t.timestamp('computed_at').notNullable().defaultTo(knex.fn.now());
    // Immutable - no updated_at
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['hcp_id', 'score_type']);
    t.index('computed_at');
  });

  await knex.schema.createTable('next_best_actions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('hcp_id').notNullable().references('id').inTable('hcps');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.enum('recommended_channel', [
      'email', 'phone', 'in_person_visit',
      'remote_detailing', 'conference', 'webinar',
    ]).notNullable();
    t.timestamp('recommended_timing');
    t.text('suggested_content');
    t.text('reasoning').notNullable(); // explainability
    t.float('confidence').notNullable();
    t.jsonb('factors').notNullable().defaultTo('[]');
    t.string('model_version', 50).notNullable();
    t.enum('status', ['pending', 'accepted', 'rejected', 'expired']).notNullable().defaultTo('pending');
    t.text('rejection_reason');
    t.timestamp('acted_on_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['user_id', 'status']);
    t.index('hcp_id');
  });

  // ─── AI CONVERSATION / COPILOT ──────────────────────────────

  await knex.schema.createTable('copilot_conversations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.string('title', 200);
    t.jsonb('context').defaultTo('{}'); // which HCP / territory context
    t.timestamps(true, true);
  });

  await knex.schema.createTable('copilot_messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('conversation_id').notNullable().references('id').inTable('copilot_conversations').onDelete('CASCADE');
    t.enum('role', ['user', 'assistant', 'system']).notNullable();
    t.text('content').notNullable();
    t.jsonb('metadata').defaultTo('{}'); // model version, tokens used, etc.
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index('conversation_id');
  });

  // ─── AUDIT LOG (IMMUTABLE) ──────────────────────────────────

  await knex.schema.createTable('audit_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('user_id').references('id').inTable('users');
    t.enum('action', [
      'create', 'update', 'delete', 'view', 'export',
      'login', 'logout', 'consent_change', 'ai_decision',
    ]).notNullable();
    t.string('entity_type', 100).notNullable();
    t.uuid('entity_id');
    t.jsonb('previous_state');
    t.jsonb('new_state');
    t.string('ip_address', 45);
    t.text('user_agent');
    t.jsonb('metadata').defaultTo('{}');
    // Immutable: only created_at, no updates
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['entity_type', 'entity_id']);
    t.index('user_id');
    t.index('action');
    t.index('created_at');
  });

  // ─── FIELD FORCE: VISIT PLANS ───────────────────────────────

  await knex.schema.createTable('visit_plans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.date('plan_date').notNullable();
    t.enum('status', ['draft', 'confirmed', 'in_progress', 'completed']).notNullable();
    t.jsonb('route_data').defaultTo('{}'); // optimized route info
    t.integer('total_visits').defaultTo(0);
    t.jsonb('metadata').defaultTo('{}');
    t.timestamps(true, true);

    t.index(['user_id', 'plan_date']);
  });

  await knex.schema.createTable('visit_plan_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('visit_plan_id').notNullable().references('id').inTable('visit_plans').onDelete('CASCADE');
    t.uuid('hcp_id').notNullable().references('id').inTable('hcps');
    t.uuid('interaction_id').references('id').inTable('interactions');
    t.integer('sequence_order').notNullable();
    t.enum('priority', ['urgent', 'high', 'medium', 'low']).notNullable();
    t.text('objective');
    t.jsonb('ai_recommendation'); // why this visit was suggested
    t.timestamps(true, true);

    t.index('visit_plan_id');
  });

  // ─── EXTERNAL DATA IMPORTS ──────────────────────────────────

  await knex.schema.createTable('data_imports', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('source', 100).notNullable(); // 'iqvia', 'symphony', 'internal_erp'
    t.string('data_type', 100).notNullable(); // 'prescription_data', 'sales_data'
    t.enum('status', ['pending', 'processing', 'completed', 'failed']).notNullable();
    t.integer('records_total').defaultTo(0);
    t.integer('records_processed').defaultTo(0);
    t.integer('records_failed').defaultTo(0);
    t.jsonb('error_log').defaultTo('[]');
    t.uuid('initiated_by').notNullable().references('id').inTable('users');
    t.timestamp('started_at');
    t.timestamp('completed_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('prescription_data', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('hcp_id').references('id').inTable('hcps');
    t.uuid('product_id').references('id').inTable('products');
    t.uuid('import_id').references('id').inTable('data_imports');
    t.integer('quantity').notNullable();
    t.date('period_start').notNullable();
    t.date('period_end').notNullable();
    t.string('source', 100);
    t.jsonb('metadata').defaultTo('{}');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index(['hcp_id', 'product_id']);
    t.index(['period_start', 'period_end']);
  });

  // ─── WEBHOOK CONFIGURATIONS ─────────────────────────────────

  await knex.schema.createTable('webhooks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 200).notNullable();
    t.string('url', 500).notNullable();
    t.jsonb('events').notNullable().defaultTo('[]'); // which events trigger it
    t.jsonb('headers').defaultTo('{}'); // custom headers
    t.string('secret', 255); // for signature verification
    t.boolean('is_active').notNullable().defaultTo(true);
    t.uuid('created_by').notNullable().references('id').inTable('users');
    t.integer('failure_count').defaultTo(0);
    t.timestamp('last_triggered_at');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'webhooks', 'prescription_data', 'data_imports',
    'visit_plan_items', 'visit_plans',
    'copilot_messages', 'copilot_conversations',
    'next_best_actions', 'ai_scores',
    'email_sends', 'email_campaigns',
    'tasks', 'interactions',
    'hcp_segments', 'segments',
    'consents', 'products',
    'hcps', 'institutions',
    'user_territories', 'territories',
    'role_permissions', 'permissions',
    'audit_log', 'users',
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }

  await knex.raw('DROP EXTENSION IF EXISTS "pgcrypto"');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}
