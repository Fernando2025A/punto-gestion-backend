// import { PrismaClient, LimitType, Permission } from '';

import { LimitType } from 'generated/prisma/client';
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
      description: 'Plan Pro',
      price: 10,
    },
  });

  await prisma.planLimit.createMany({
    data: [
      {
        planId: proPlan.id,
        type: LimitType.PRODUCTS,
        value: 200,
      },
      {
        planId: proPlan.id,
        type: LimitType.EMPLOYEES,
        value: 5,
      },
      {
        planId: proPlan.id,
        type: LimitType.MOVEMENTS,
        value: 2000,
      },
      {
        planId: proPlan.id,
        type: LimitType.IMAGES,
        value: 250,
      },
      {
        planId: proPlan.id,
        type: LimitType.SUPPLIERS,
        value: 30,
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
