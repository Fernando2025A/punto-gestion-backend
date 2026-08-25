import { LimitType, Permission } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const prisma = new PrismaService();

async function main() {
  const freePlan = await prisma.plan.upsert({
    where: {
      name: 'FREE',
    },
    update: {},
    create: {
      name: 'FREE',
      description: 'Plan gratuito',
      price: 0,
    },
  });

  await prisma.planLimit.createMany({
    data: [
      {
        planId: freePlan.id,
        type: LimitType.PRODUCTS,
        value: 30,
      },
      {
        planId: freePlan.id,
        type: LimitType.EMPLOYEES,
        value: 2,
      },
      {
        planId: freePlan.id,
        type: LimitType.MOVEMENTS,
        value: 500,
      },
      {
        planId: freePlan.id,
        type: LimitType.IMAGES,
        value: 50,
      },
      {
        planId: freePlan.id,
        type: LimitType.SUPPLIERS,
        value: 10,
      },
      {
        planId: freePlan.id,
        type: LimitType.EXPENSES,
        value: 20,
      },
      {
        planId: freePlan.id,
        type: LimitType.INVITATIONS,
        value: 20,
      },
    ],
    skipDuplicates: true,
  });
  const proPlan = await prisma.plan.upsert({
    where: {
      name: 'PRO',
    },
    update: {},
    create: {
      name: 'PRO',
      description: 'Con todo lo que necesita tu negocio para crecer',
      price: 5,
    },
  });

  await prisma.planLimit.createMany({
    data: [
      {
        planId: proPlan.id,
        type: LimitType.PRODUCTS,
        value: 500,
      },
      {
        planId: proPlan.id,
        type: LimitType.EMPLOYEES,
        value: 10,
      },
      {
        planId: proPlan.id,
        type: LimitType.MOVEMENTS,
        value: 2000,
      },
      {
        planId: proPlan.id,
        type: LimitType.IMAGES,
        value: 1000,
      },
      {
        planId: proPlan.id,
        type: LimitType.SUPPLIERS,
        value: 50,
      },
      {
        planId: proPlan.id,
        type: LimitType.EXPENSES,
        value: 50,
      },
      {
        planId: proPlan.id,
        type: LimitType.INVITATIONS,
        value: 50,
      },
    ],
    skipDuplicates: true,
  });

  const proPlanPlus = await prisma.plan.upsert({
    where: {
      name: 'PRO+',
    },
    update: {},
    create: {
      name: 'PRO+',
      description: 'Diseñado para llevar tu negocio al siguiente nivel',
      price: 15,
    },
  });

  await prisma.planLimit.createMany({
    data: [
      {
        planId: proPlanPlus.id,
        type: LimitType.PRODUCTS,
        value: 2000,
      },
      {
        planId: proPlanPlus.id,
        type: LimitType.EMPLOYEES,
        value: 100,
      },
      {
        planId: proPlanPlus.id,
        type: LimitType.MOVEMENTS,
        value: 10000,
      },
      {
        planId: proPlanPlus.id,
        type: LimitType.IMAGES,
        value: 1000,
      },
      {
        planId: proPlanPlus.id,
        type: LimitType.SUPPLIERS,
        value: 1000,
      },
      {
        planId: proPlanPlus.id,
        type: LimitType.EXPENSES,
        value: 2000,
      },
      {
        planId: proPlanPlus.id,
        type: LimitType.INVITATIONS,
        value: 1000,
      },
    ],
    skipDuplicates: true,
  });
  await prisma.planPermission.createMany({
    data: [
      {
        planId: proPlanPlus.id,
        permission: Permission.EXPORT_REPORTS_PDF,
      },
      {
        planId: proPlanPlus.id,
        permission: Permission.EXPORT_REPORTS_EXCEL,
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
