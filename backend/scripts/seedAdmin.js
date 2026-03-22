/**
 * One-time: create an admin user from env.
 * Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME="Admin" node scripts/seedAdmin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User } = require('../src/models/User');

async function main() {
  const uri = process.env.MONGODB_URI;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!uri || !email || !password) {
    // eslint-disable-next-line no-console
    console.error('Set MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = await bcrypt.hash(String(password), 10);
    await existing.save();
    // eslint-disable-next-line no-console
    console.log('Updated existing user to admin:', email);
  } else {
    const passwordHash = await bcrypt.hash(String(password), 10);
    await User.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'admin'
    });
    // eslint-disable-next-line no-console
    console.log('Created admin:', email);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
