import knex from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const db = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'pharmacrm',
    user: 'pharmacrm_user',
    password: 'dev_password_change_me',
  },
});

async function run() {
  try {
    console.log('Seeding database...');

    // Permissions
    const permissions = [
      { id: uuidv4(), name: 'hcp.read', module: 'hcp', action: 'read', description: 'View HCP profiles' },
      { id: uuidv4(), name: 'hcp.write', module: 'hcp', action: 'write', description: 'Create/edit HCP profiles' },
      { id: uuidv4(), name: 'analytics.read', module: 'analytics', action: 'read', description: 'View analytics' },
    ];
    await db('permissions').insert(permissions);
    console.log('Permissions created');

    // Territories
    const territories = [
      { id: uuidv4(), name: 'Northeast', code: 'NE-001', region: 'Northeast', country: 'USA' },
      { id: uuidv4(), name: 'Southeast', code: 'SE-001', region: 'Southeast', country: 'USA' },
      { id: uuidv4(), name: 'Midwest', code: 'MW-001', region: 'Midwest', country: 'USA' },
      { id: uuidv4(), name: 'West Coast', code: 'WC-001', region: 'West', country: 'USA' },
    ];
    await db('territories').insert(territories);
    console.log('Territories created');

    // Admin user (password: Admin123!)
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    await db('users').insert({
      id: adminId,
      email: 'admin@pharmacrm.dev',
      password_hash: passwordHash,
      first_name: 'System',
      last_name: 'Administrator',
      role: 'admin',
      is_active: true,
    });
    console.log('Admin user created: admin@pharmacrm.dev / Admin123!');

    // Field rep user
    const repId = uuidv4();
    const repHash = await bcrypt.hash('Rep123!', 12);
    await db('users').insert({
      id: repId,
      email: 'rep@pharmacrm.dev',
      password_hash: repHash,
      first_name: 'Sarah',
      last_name: 'Johnson',
      role: 'field_rep',
      is_active: true,
    });

    // Assign territory to rep
    await db('user_territories').insert({
      id: uuidv4(),
      user_id: repId,
      territory_id: territories[0].id,
      is_primary: true,
    });
    console.log('Field rep created: rep@pharmacrm.dev / Rep123!');

    // Products
    const products = [
      {
        id: uuidv4(), name: 'CardioShield', brand_name: 'CardioShield XR',
        generic_name: 'lisinopril extended-release', therapeutic_area: 'cardiovascular',
        description: 'Cardiovascular product', status: 'active',
        indications: JSON.stringify(['hypertension']),
      },
      {
        id: uuidv4(), name: 'NeuroCalm', brand_name: 'NeuroCalm',
        generic_name: 'gabapentin modified-release', therapeutic_area: 'neurology',
        description: 'Neurology product', status: 'active',
        indications: JSON.stringify(['neuropathic pain']),
      },
    ];
    await db('products').insert(products);
    console.log('Products created');

    // Sample HCPs (using encrypted PII)
    const CryptoJS = require('crypto-js');
    const key = CryptoJS.enc.Hex.parse('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    const iv = CryptoJS.enc.Hex.parse('0123456789abcdef0123456789abcdef');

    const encrypt = (text: string) => CryptoJS.AES.encrypt(text, key, { iv }).toString();
    const hash = (text: string) => CryptoJS.SHA256(text + '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef').toString();

    const hcps = [
      { firstName: 'James', lastName: 'Wilson', specialty: 'cardiology', influence: 'key_opinion_leader', email: 'jwilson@hospital.com' },
      { firstName: 'Emily', lastName: 'Chen', specialty: 'oncology', influence: 'high', email: 'echen@hospital.com' },
      { firstName: 'Michael', lastName: 'Roberts', specialty: 'neurology', influence: 'medium', email: 'mroberts@clinic.com' },
      { firstName: 'Lisa', lastName: 'Park', specialty: 'endocrinology', influence: 'high', email: 'lpark@hospital.com' },
      { firstName: 'David', lastName: 'Thompson', specialty: 'general_practice', influence: 'medium', email: 'dthompson@practice.com' },
    ];

    for (const hcp of hcps) {
      const hcpId = uuidv4();
      await db('hcps').insert({
        id: hcpId,
        first_name_encrypted: encrypt(hcp.firstName),
        first_name_hash: hash(hcp.firstName.toLowerCase()),
        last_name_encrypted: encrypt(hcp.lastName),
        last_name_hash: hash(hcp.lastName.toLowerCase()),
        email_encrypted: encrypt(hcp.email),
        email_hash: hash(hcp.email.toLowerCase()),
        specialty: hcp.specialty,
        influence_level: hcp.influence,
        territory_id: territories[Math.floor(Math.random() * territories.length)].id,
        title: 'Dr.',
        years_of_practice: 10 + Math.floor(Math.random() * 20),
        languages: JSON.stringify(['English']),
        therapeutic_areas: JSON.stringify([hcp.specialty]),
        is_active: true,
      });

      // Grant some consents
      await db('consents').insert({
        id: uuidv4(),
        hcp_id: hcpId,
        consent_type: 'email',
        status: 'granted',
        granted_at: new Date(),
        source: 'seed_data',
        recorded_by: adminId,
      });
      await db('consents').insert({
        id: uuidv4(),
        hcp_id: hcpId,
        consent_type: 'visit',
        status: 'granted',
        granted_at: new Date(),
        source: 'seed_data',
        recorded_by: adminId,
      });
    }
    console.log(`${hcps.length} HCPs created with consent records`);

    console.log('\nSeed completed successfully!');
    console.log('\nLogin credentials:');
    console.log('  Admin: admin@pharmacrm.dev / Admin123!');
    console.log('  Rep:   rep@pharmacrm.dev / Rep123!');

  } catch (e: unknown) {
    console.error('Seed error:', (e as Error).message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

run();
