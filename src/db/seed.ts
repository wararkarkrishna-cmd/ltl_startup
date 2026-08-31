import { dbClient } from './client';
import { generateUuidV7 } from '../lib/uuidv7';
import { AccessorialLookup, Tenant, User, Account } from './schema';

export async function seedDatabase(client = dbClient) {
  console.log('[Seed] Starting database seed...');

  // 1. Create Default Tenant
  const tenantId = generateUuidV7();
  const demoTenant: Tenant = {
    id: tenantId,
    name: 'Apex Freight Logistics, LLC',
    slug: 'apex-freight',
    apiKeyHash: 'sha256_mock_api_key_hash_apex_2026',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  client.tenants.set(tenantId, demoTenant);
  client.setTenantContext(tenantId);

  // 2. Create Default Users
  const ownerUserId = generateUuidV7();
  const brokerUser: User = {
    id: ownerUserId,
    tenantId,
    email: 'alex.broker@apexfreight.io',
    fullName: 'Alex Reynolds',
    role: 'OWNER',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  client.users.set(ownerUserId, brokerUser);

  // 3. Create Default Accounts (Shipper & Carriers)
  const shipperId = generateUuidV7();
  const shipperAccount: Account = {
    id: shipperId,
    tenantId,
    name: 'PacWest Industrial Supplies',
    accountType: 'SHIPPER',
    mcNumber: null,
    dotNumber: null,
    contactName: 'Sarah Jenkins',
    contactEmail: 's.jenkins@pacwestsupplies.com',
    contactPhone: '+1-213-555-0199',
    billingAddressLine1: '1420 Olympic Blvd',
    billingCity: 'Los Angeles',
    billingState: 'CA',
    billingZip: '90015',
    creditLimitCents: 5000000, // $50,000.00
    paymentTermsDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  client.accounts.set(shipperId, shipperAccount);

  // 4. Seed Standard Accessorials
  const standardAccessorials: Array<Omit<AccessorialLookup, 'id' | 'createdAt'>> = [
    {
      code: 'LG_PU',
      name: 'Liftgate Pickup',
      description: 'Hydraulic liftgate required at shipper origin location.',
      category: 'PICKUP',
      defaultFeeCents: 7500,
    },
    {
      code: 'LG_DEL',
      name: 'Liftgate Delivery',
      description: 'Hydraulic liftgate required at consignee destination location.',
      category: 'DELIVERY',
      defaultFeeCents: 7500,
    },
    {
      code: 'RES_PU',
      name: 'Residential Pickup',
      description: 'Origin location is inside a residential zone or home business.',
      category: 'PICKUP',
      defaultFeeCents: 8500,
    },
    {
      code: 'RES_DEL',
      name: 'Residential Delivery',
      description: 'Destination location is inside a residential zone or home business.',
      category: 'DELIVERY',
      defaultFeeCents: 8500,
    },
    {
      code: 'LIM_ACC',
      name: 'Limited Access Location',
      description: 'Location has security gates, construction site, military base, school, or church.',
      category: 'ACCESS',
      defaultFeeCents: 9500,
    },
    {
      code: 'INS_DEL',
      name: 'Inside Delivery',
      description: 'Freight must be moved past the immediate threshold or dock into building.',
      category: 'DELIVERY',
      defaultFeeCents: 12000,
    },
    {
      code: 'NOTIFY',
      name: 'Notification / Appointment Required',
      description: 'Call or appointment required 24 hours prior to delivery.',
      category: 'SCHEDULING',
      defaultFeeCents: 3500,
    },
    {
      code: 'HAZMAT',
      name: 'Hazardous Materials Handling',
      description: 'Requires DOT hazardous materials placard, certification, and emergency contact info.',
      category: 'COMPLIANCE',
      defaultFeeCents: 15000,
    },
    {
      code: 'TRADESHOW',
      name: 'Convention / Tradeshow Delivery',
      description: 'Delivery to exhibition center marshalling yard.',
      category: 'DELIVERY',
      defaultFeeCents: 25000,
    },
    {
      code: 'SORT_SEG',
      name: 'Sort & Segregate',
      description: 'Driver or lumpers break down pallets by SKU / PO number.',
      category: 'HANDLING',
      defaultFeeCents: 11000,
    },
    {
      code: 'DETENTION',
      name: 'Driver Detention Time',
      description: 'Billed per hour after 2 free hours at loading / unloading dock.',
      category: 'ACCESSORIAL',
      defaultFeeCents: 8500,
    },
  ];

  for (const acc of standardAccessorials) {
    const accId = generateUuidV7();
    client.accessorials.set(acc.code, {
      ...acc,
      id: accId,
      createdAt: new Date(),
    });
  }

  console.log(`[Seed] Seeded 1 tenant, 1 user, 1 account, ${standardAccessorials.length} accessorials.`);
  return { tenantId, ownerUserId, shipperId };
}

if (require.main === module) {
  seedDatabase().catch(console.error);
}
