import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seeds the database with initial data for development/testing.
 */
export async function seed(knex: Knex): Promise<void> {
  // ─── Permissions ─────────────────────────────────────────────
  const permissions = [
    { id: uuidv4(), name: 'hcp.read', module: 'hcp', action: 'read', description: 'View HCP profiles' },
    { id: uuidv4(), name: 'hcp.write', module: 'hcp', action: 'write', description: 'Create/edit HCP profiles' },
    { id: uuidv4(), name: 'hcp.delete', module: 'hcp', action: 'delete', description: 'Delete HCP profiles' },
    { id: uuidv4(), name: 'interaction.read', module: 'engagement', action: 'read', description: 'View interactions' },
    { id: uuidv4(), name: 'interaction.write', module: 'engagement', action: 'write', description: 'Log interactions' },
    { id: uuidv4(), name: 'task.read', module: 'engagement', action: 'read', description: 'View tasks' },
    { id: uuidv4(), name: 'task.write', module: 'engagement', action: 'write', description: 'Create/edit tasks' },
    { id: uuidv4(), name: 'analytics.read', module: 'analytics', action: 'read', description: 'View analytics' },
    { id: uuidv4(), name: 'compliance.read', module: 'compliance', action: 'read', description: 'View audit logs' },
    { id: uuidv4(), name: 'campaign.read', module: 'omnichannel', action: 'read', description: 'View campaigns' },
    { id: uuidv4(), name: 'campaign.write', module: 'omnichannel', action: 'write', description: 'Create campaigns' },
    { id: uuidv4(), name: 'campaign.approve', module: 'omnichannel', action: 'approve', description: 'Approve campaigns' },
    { id: uuidv4(), name: 'integration.manage', module: 'integration', action: 'manage', description: 'Manage integrations' },
    { id: uuidv4(), name: 'ai.use', module: 'ai', action: 'use', description: 'Use AI features' },
  ];

  await knex('permissions').insert(permissions);

  // ─── Territories ─────────────────────────────────────────────
  const territories = [
    { id: uuidv4(), name: 'Northeast', code: 'NE-001', region: 'Northeast', country: 'USA' },
    { id: uuidv4(), name: 'Southeast', code: 'SE-001', region: 'Southeast', country: 'USA' },
    { id: uuidv4(), name: 'Midwest', code: 'MW-001', region: 'Midwest', country: 'USA' },
    { id: uuidv4(), name: 'West Coast', code: 'WC-001', region: 'West', country: 'USA' },
  ];

  await knex('territories').insert(territories);

  // ─── Admin User ──────────────────────────────────────────────
  const adminId = uuidv4();
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  await knex('users').insert({
    id: adminId,
    email: 'admin@pharmacrm.dev',
    password_hash: passwordHash,
    first_name: 'System',
    last_name: 'Administrator',
    role: 'admin',
    is_active: true,
  });

  // ─── Products ────────────────────────────────────────────────
  await knex('products').insert([
    {
      id: uuidv4(),
      name: 'CardioShield',
      brand_name: 'CardioShield XR',
      generic_name: 'lisinopril extended-release',
      therapeutic_area: 'cardiovascular',
      description: 'Cardiovascular product',
      status: 'active',
      indications: JSON.stringify(['hypertension']),
    },
    {
      id: uuidv4(),
      name: 'NeuroCalm',
      brand_name: 'NeuroCalm',
      generic_name: 'gabapentin modified-release',
      therapeutic_area: 'neurology',
      description: 'Neurology product',
      status: 'active',
      indications: JSON.stringify(['neuropathic pain']),
    },
  ]);
}
