import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'Administrador del Sistema',
      ci: '0000000',
      phone: '00000000',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      shift: 'MANANA',
      canApplyPromotions: true,
    },
  });

  console.log('✅ Base de datos sincronizada con éxito.');
  console.log(`👤 Usuario Admin creado: ${admin.username}`);
  console.log(`🔑 Contraseña Admin: admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
