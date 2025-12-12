import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data - DELETE ALL TABLES
  console.log('🧹 Clearing ALL tables in database...');

  // Delete in correct order to respect foreign key constraints
  // Start with tables that have no dependents or only reference other tables

  // Auth & Session tables
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();

  // Audit & Logs
  await prisma.auditLog.deleteMany();

  // Chat related
  await prisma.activeChat.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();

  // Notifications
  await prisma.notification.deleteMany();

  // Extrajudicial notifications
  await prisma.extrajudicialNotificationAudit.deleteMany();
  await prisma.extrajudicialNotification.deleteMany();

  // Service contracts (references property via ServiceContractProperty)
  await prisma.serviceContractClauseHistory.deleteMany();
  await prisma.serviceContractProperty.deleteMany();
  await prisma.serviceContract.deleteMany();

  // Financial tables
  await prisma.transfer.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();

  // Contract related
  await prisma.contractClauseHistory.deleteMany();
  await prisma.contractAudit.deleteMany();
  await prisma.contract.deleteMany();

  // Inspection related
  await prisma.inspectionMedia.deleteMany();
  await prisma.inspectionSignatureLink.deleteMany();
  await prisma.inspectionItem.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.inspectionTemplate.deleteMany();

  // Property related
  await prisma.agreement.deleteMany();
  await prisma.agreementTemplate.deleteMany();
  await prisma.document.deleteMany();
  await prisma.propertyImage.deleteMany();
  await prisma.property.deleteMany();

  // Organization tables
  await prisma.agency.deleteMany();
  await prisma.company.deleteMany();

  // Settings & indexes
  await prisma.platformSettings.deleteMany();
  await prisma.igpmIndex.deleteMany();

  // Plan modification requests (references User)
  await prisma.planModificationRequest.deleteMany();

  // Tenant analysis (references User)
  await prisma.tenantAnalysis.deleteMany();

  // Sales Rep CRM tables (reference User)
  await prisma.salesActivity.deleteMany();
  await prisma.salesGoal.deleteMany();
  await prisma.salesCommission.deleteMany();
  await prisma.salesProposal.deleteMany();
  await prisma.salesProspect.deleteMany();

  // Sales Inbox tables (reference User)
  await prisma.salesMessageReply.deleteMany();
  await prisma.salesNotification.deleteMany();
  await prisma.salesMessage.deleteMany();

  // Handle User self-referential foreign keys before deleting users
  // User has: ownerId, brokerId, createdBy - all pointing to other users
  await prisma.user.updateMany({
    data: {
      ownerId: null,
      brokerId: null,
      createdBy: null,
      legalRepresentativeId: null,
    },
  });

  // Legal representatives and Users
  await prisma.legalRepresentative.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ All tables cleared successfully!');

  // Create only CEO user
  // Per MR3X Hierarchy Requirements:
  // - CEO is the root profile, created only once
  // - CEO creates ADMIN users
  // - All other users are created through the proper hierarchy
  console.log('👤 Creating CEO user...');
  const hashedPassword = await bcrypt.hash('123456', 10);

  const ceo = await prisma.user.create({
    data: {
      email: 'ceo@gmail.com',
      password: hashedPassword,
      plainPassword: '123456',
      role: UserRole.CEO,
      plan: 'PROFISSIONAL',
      name: 'CEO MR3X',
      phone: '(11) 99999-0001',
      document: '123.456.789-00',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📋 Account Created:');
  console.log('CEO: ceo@gmail.com / 123456');
  console.log('\n📌 Note: Per MR3X Hierarchy Requirements:');
  console.log('   - CEO can only create ADMIN users');
  console.log('   - ADMIN can create: AGENCY_MANAGER, LEGAL_AUDITOR, REPRESENTATIVE, API_CLIENT');
  console.log('   - AGENCY_ADMIN can create: AGENCY_MANAGER, BROKER, PROPRIETARIO');
  console.log('   - AGENCY_MANAGER can create: BROKER, PROPRIETARIO');
  console.log('   - INDEPENDENT_OWNER can create: INQUILINO, BUILDING_MANAGER');
  console.log('   - All other roles are created through self-registration or by authorized users');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
