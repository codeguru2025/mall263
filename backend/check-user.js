require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function check() {
  try {
    console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 30) + '...');
    
    // Find the user by phone
    const user = await prisma.user.findUnique({
      where: { phone: '+263773665350' },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        passwordHash: true,
      },
    });

    if (!user) {
      console.log('\nERROR: No user found with phone +263773665350');
      console.log('The seed has NOT been run against this database!');
      return;
    }

    console.log('\nUser found:');
    console.log('  ID:', user.id);
    console.log('  Phone:', user.phone);
    console.log('  Email:', user.email);
    console.log('  Name:', user.firstName, user.lastName);
    console.log('  Role:', user.role);
    console.log('  Status:', user.status);
    console.log('  Hash:', user.passwordHash);
    console.log('  Hash length:', user.passwordHash.length);

    // Now test password compare
    const password = '*Amell.Max1#';
    const match = await bcrypt.compare(password, user.passwordHash);
    console.log('\n  Password "*Amell.Max1#" matches hash:', match);

    if (!match) {
      console.log('\n  >>> PASSWORD DOES NOT MATCH THE STORED HASH <<<');
      console.log('  The password was likely different when the seed ran,');
      console.log('  or the hash got corrupted/truncated.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
