import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, ProjectStatus, TaskStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { resolvePoolSsl } from '../src/pool-ssl';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}
const ssl = resolvePoolSsl(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl,
  ...(ssl ? { ssl } : {}),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding EthioTelecom Project Manager...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ethiotelecom.et' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@ethiotelecom.et',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
    },
  });

  const staff1 = await prisma.user.upsert({
    where: { email: 'staff1@ethiotelecom.et' },
    update: {},
    create: {
      name: 'Abebe Kebede',
      email: 'staff1@ethiotelecom.et',
      password: hashedPassword,
      role: 'USER',
      isActive: true,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Abebe',
    },
  });

  const staff2 = await prisma.user.upsert({
    where: { email: 'staff2@ethiotelecom.et' },
    update: {},
    create: {
      name: 'Aster Bekele',
      email: 'staff2@ethiotelecom.et',
      password: hashedPassword,
      role: 'USER',
      isActive: true,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aster',
    },
  });

  const divisionNames = ['Network', 'IT', 'Customer Service', 'Finance', 'HR', 'General'];
  const divisions = await Promise.all(
    divisionNames.map((name) =>
      prisma.division.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.project.deleteMany();

  const fiberProject = await prisma.project.create({
    data: {
      name: 'Addis Fiber Expansion',
      description: 'Roll out fiber broadband to new districts and close remaining installation tasks.',
      status: ProjectStatus.ACTIVE,
      divisionId: divisions[0].id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21),
      createdById: admin.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: staff1.id, role: 'MEMBER' },
          { userId: staff2.id, role: 'MEMBER' },
        ],
      },
      tasks: {
        create: [
          {
            title: 'Survey district routes',
            description: 'Map fiber routes for Bole and Kirkos districts.',
            status: TaskStatus.DONE,
            priority: 'HIGH',
            category: 'FIBER_BROADBAND',
            reporterId: admin.id,
            assigneeId: staff1.id,
            divisionId: divisions[0].id,
          },
          {
            title: 'Install last-mile cabinets',
            description: 'Deploy outdoor cabinets and validate power readiness.',
            status: TaskStatus.IN_PROGRESS,
            priority: 'CRITICAL',
            category: 'FIBER_BROADBAND',
            reporterId: admin.id,
            assigneeId: staff2.id,
            divisionId: divisions[0].id,
            dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
          },
          {
            title: 'Customer activation checklist',
            description: 'Prepare activation scripts for the first 200 households.',
            status: TaskStatus.TODO,
            priority: 'MEDIUM',
            category: 'FIBER_BROADBAND',
            reporterId: staff1.id,
            assigneeId: staff1.id,
            divisionId: divisions[0].id,
          },
        ],
      },
    },
  });

  const telebirrProject = await prisma.project.create({
    data: {
      name: 'Telebirr Billing Stabilization',
      description: 'Resolve billing reconciliation gaps and finish remaining verification tasks.',
      status: ProjectStatus.ACTIVE,
      divisionId: divisions[3].id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      createdById: staff1.id,
      members: {
        create: [
          { userId: staff1.id, role: 'OWNER' },
          { userId: admin.id, role: 'MEMBER' },
        ],
      },
      tasks: {
        create: [
          {
            title: 'Reconcile failed settlements',
            description: 'Match failed Telebirr settlements from the last sprint.',
            status: TaskStatus.DONE,
            priority: 'HIGH',
            category: 'TELEBIRR_BILLING',
            reporterId: staff1.id,
            assigneeId: admin.id,
            divisionId: divisions[3].id,
          },
          {
            title: 'Publish ops runbook',
            description: 'Document escalation paths for billing ops.',
            status: TaskStatus.DONE,
            priority: 'MEDIUM',
            category: 'TELEBIRR_BILLING',
            reporterId: staff1.id,
            assigneeId: staff1.id,
            divisionId: divisions[3].id,
          },
        ],
      },
    },
  });

  // Auto-complete project when all tasks are DONE
  await prisma.project.update({
    where: { id: telebirrProject.id },
    data: { status: ProjectStatus.COMPLETED },
  });

  await prisma.activityLog.create({
    data: {
      projectId: telebirrProject.id,
      actorId: admin.id,
      action: 'PROJECT_AUTO_COMPLETED',
      oldValue: ProjectStatus.ACTIVE,
      newValue: ProjectStatus.COMPLETED,
    },
  });

  console.log('Seed complete.');
  console.log(`Projects: ${fiberProject.name} (ACTIVE), ${telebirrProject.name} (COMPLETED)`);
  console.log('Demo logins: admin@ethiotelecom.et / staff1@ethiotelecom.et / staff2@ethiotelecom.et');
  console.log('Password: password123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
