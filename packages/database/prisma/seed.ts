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

const day = (offset: number) => new Date(Date.now() + 1000 * 60 * 60 * 24 * offset);

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

  const [network, it, customerService, finance, hr, general] = divisions;

  await prisma.comment.deleteMany();
  await prisma.taskImage.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.project.deleteMany();

  const fiberProject = await prisma.project.create({
    data: {
      name: 'Addis Fiber Expansion',
      description:
        'Roll out fiber broadband to new districts and close remaining installation tasks.',
      status: ProjectStatus.ACTIVE,
      divisionId: network.id,
      dueDate: day(21),
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
            divisionId: network.id,
          },
          {
            title: 'Install last-mile cabinets',
            description: 'Deploy outdoor cabinets and validate power readiness.',
            status: TaskStatus.IN_PROGRESS,
            priority: 'CRITICAL',
            category: 'FIBER_BROADBAND',
            reporterId: admin.id,
            assigneeId: staff2.id,
            divisionId: network.id,
            dueDate: day(-2),
          },
          {
            title: 'Customer activation checklist',
            description: 'Prepare activation scripts for the first 200 households.',
            status: TaskStatus.TODO,
            priority: 'MEDIUM',
            category: 'FIBER_BROADBAND',
            reporterId: staff1.id,
            assigneeId: staff1.id,
            divisionId: network.id,
            dueDate: day(7),
          },
        ],
      },
    },
  });

  const telebirrProject = await prisma.project.create({
    data: {
      name: 'Telebirr Billing Stabilization',
      description:
        'Resolve billing reconciliation gaps and finish remaining verification tasks.',
      status: ProjectStatus.ACTIVE,
      divisionId: finance.id,
      dueDate: day(10),
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
            divisionId: finance.id,
          },
          {
            title: 'Publish ops runbook',
            description: 'Document escalation paths for billing ops.',
            status: TaskStatus.DONE,
            priority: 'MEDIUM',
            category: 'TELEBIRR_BILLING',
            reporterId: staff1.id,
            assigneeId: staff1.id,
            divisionId: finance.id,
          },
        ],
      },
    },
  });

  const completedTelebirr = await prisma.project.update({
    where: { id: telebirrProject.id },
    data: { status: ProjectStatus.COMPLETED },
  });

  await prisma.activityLog.create({
    data: {
      projectId: completedTelebirr.id,
      actorId: admin.id,
      action: 'PROJECT_AUTO_COMPLETED',
      oldValue: ProjectStatus.ACTIVE,
      newValue: ProjectStatus.COMPLETED,
    },
  });

  const mobileCoverageProject = await prisma.project.create({
    data: {
      name: '5G Pilot Coverage — Bole',
      description:
        'Launch the Bole 5G pilot sites, complete radio tuning, and validate handset performance.',
      status: ProjectStatus.ACTIVE,
      divisionId: network.id,
      dueDate: day(30),
      createdById: admin.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: staff2.id, role: 'MEMBER' },
        ],
      },
      tasks: {
        create: [
          {
            title: 'Commission pilot radios',
            description: 'Bring up three 5G radios and confirm backhaul capacity.',
            status: TaskStatus.DONE,
            priority: 'CRITICAL',
            category: 'MOBILE_NETWORK',
            reporterId: admin.id,
            assigneeId: staff2.id,
            divisionId: network.id,
          },
          {
            title: 'Drive-test coverage map',
            description: 'Collect RSRP/SINR samples across the pilot zone.',
            status: TaskStatus.IN_PROGRESS,
            priority: 'HIGH',
            category: 'MOBILE_NETWORK',
            reporterId: admin.id,
            assigneeId: staff2.id,
            divisionId: network.id,
            dueDate: day(5),
          },
          {
            title: 'Handset compatibility checklist',
            description: 'Validate top 10 handsets on NSA and SA modes.',
            status: TaskStatus.TODO,
            priority: 'MEDIUM',
            category: 'MOBILE_NETWORK',
            reporterId: staff2.id,
            assigneeId: admin.id,
            divisionId: network.id,
            dueDate: day(14),
          },
          {
            title: 'Publish pilot KPI dashboard',
            description: 'Share daily availability and throughput KPIs with leadership.',
            status: TaskStatus.TODO,
            priority: 'LOW',
            category: 'MOBILE_NETWORK',
            reporterId: admin.id,
            assigneeId: staff2.id,
            divisionId: network.id,
            dueDate: day(18),
          },
        ],
      },
    },
  });

  const crmUpgradeProject = await prisma.project.create({
    data: {
      name: 'Customer Care CRM Upgrade',
      description:
        'Migrate contact-center agents to the new CRM, train teams, and cut over ticket workflows.',
      status: ProjectStatus.ACTIVE,
      divisionId: customerService.id,
      dueDate: day(45),
      createdById: staff2.id,
      members: {
        create: [
          { userId: staff2.id, role: 'OWNER' },
          { userId: staff1.id, role: 'MEMBER' },
          { userId: admin.id, role: 'MEMBER' },
        ],
      },
      tasks: {
        create: [
          {
            title: 'Migrate historical tickets',
            description: 'Import open and closed tickets from the legacy CRM.',
            status: TaskStatus.IN_PROGRESS,
            priority: 'HIGH',
            category: 'OTHER',
            reporterId: staff2.id,
            assigneeId: staff1.id,
            divisionId: customerService.id,
            dueDate: day(3),
          },
          {
            title: 'Agent training sessions',
            description: 'Run train-the-trainer workshops for Addis and regional hubs.',
            status: TaskStatus.TODO,
            priority: 'MEDIUM',
            category: 'OTHER',
            reporterId: staff2.id,
            assigneeId: staff2.id,
            divisionId: customerService.id,
            dueDate: day(12),
          },
          {
            title: 'Cut-over weekend plan',
            description: 'Finalize freeze window, rollback steps, and support roster.',
            status: TaskStatus.TODO,
            priority: 'CRITICAL',
            category: 'OTHER',
            reporterId: admin.id,
            assigneeId: admin.id,
            divisionId: customerService.id,
            dueDate: day(20),
          },
        ],
      },
    },
  });

  const coreInfraProject = await prisma.project.create({
    data: {
      name: 'Core Data Center Cooling Retrofit',
      description:
        'Upgrade cooling and power monitoring in the primary data center to reduce outage risk.',
      status: ProjectStatus.ACTIVE,
      divisionId: it.id,
      dueDate: day(60),
      createdById: staff1.id,
      members: {
        create: [
          { userId: staff1.id, role: 'OWNER' },
          { userId: admin.id, role: 'MEMBER' },
          { userId: staff2.id, role: 'MEMBER' },
        ],
      },
      tasks: {
        create: [
          {
            title: 'Audit current CRAC units',
            description: 'Inventory cooling capacity and identify failing units.',
            status: TaskStatus.DONE,
            priority: 'HIGH',
            category: 'CORE_INFRASTRUCTURE',
            reporterId: staff1.id,
            assigneeId: staff1.id,
            divisionId: it.id,
          },
          {
            title: 'Install redundant cooling loop',
            description: 'Deploy secondary cooling path for hall B.',
            status: TaskStatus.IN_PROGRESS,
            priority: 'CRITICAL',
            category: 'CORE_INFRASTRUCTURE',
            reporterId: staff1.id,
            assigneeId: admin.id,
            divisionId: it.id,
            dueDate: day(8),
          },
          {
            title: 'Wire power telemetry alerts',
            description: 'Connect PDU sensors to the ops alerting channel.',
            status: TaskStatus.TODO,
            priority: 'MEDIUM',
            category: 'CORE_INFRASTRUCTURE',
            reporterId: admin.id,
            assigneeId: staff2.id,
            divisionId: it.id,
            dueDate: day(25),
          },
          {
            title: 'Run failover drill',
            description: 'Simulate cooling failure and validate recovery runbook.',
            status: TaskStatus.TODO,
            priority: 'HIGH',
            category: 'CORE_INFRASTRUCTURE',
            reporterId: staff1.id,
            assigneeId: staff1.id,
            divisionId: it.id,
            dueDate: day(40),
          },
        ],
      },
    },
  });

  const hrOnboardingProject = await prisma.project.create({
    data: {
      name: 'Staff Onboarding Digitization',
      description:
        'Digitize HR onboarding checklists, access provisioning, and new-hire orientation tracking.',
      status: ProjectStatus.ACTIVE,
      divisionId: hr.id,
      dueDate: day(35),
      createdById: admin.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: staff1.id, role: 'MEMBER' },
        ],
      },
      tasks: {
        create: [
          {
            title: 'Define onboarding workflow',
            description: 'Document day-0 through day-30 steps for network and IT hires.',
            status: TaskStatus.DONE,
            priority: 'MEDIUM',
            category: 'OTHER',
            reporterId: admin.id,
            assigneeId: admin.id,
            divisionId: hr.id,
          },
          {
            title: 'Build access request form',
            description: 'Create the form that triggers VPN, email, and tool access.',
            status: TaskStatus.IN_PROGRESS,
            priority: 'HIGH',
            category: 'OTHER',
            reporterId: admin.id,
            assigneeId: staff1.id,
            divisionId: hr.id,
            dueDate: day(6),
          },
          {
            title: 'Pilot with two new hires',
            description: 'Run the digitized flow with the next Network and Finance joiners.',
            status: TaskStatus.TODO,
            priority: 'MEDIUM',
            category: 'OTHER',
            reporterId: staff1.id,
            assigneeId: staff1.id,
            divisionId: hr.id,
            dueDate: day(22),
          },
        ],
      },
    },
  });

  // Keep `general` referenced so the division set stays intentional for demos.
  void general;

  const projects = [
    fiberProject,
    completedTelebirr,
    mobileCoverageProject,
    crmUpgradeProject,
    coreInfraProject,
    hrOnboardingProject,
  ];

  const taskCount = await prisma.task.count();
  console.log('Seed complete.');
  console.log(`Created ${projects.length} projects with ${taskCount} tasks total:`);
  for (const project of projects) {
    const count = await prisma.task.count({ where: { projectId: project.id } });
    console.log(`  - ${project.name} [${project.status}] · ${count} tasks`);
  }
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
