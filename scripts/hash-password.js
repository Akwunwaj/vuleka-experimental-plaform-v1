const { hashPassword } = require('../src/services/auth');

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: node scripts/hash-password.js "your-password"');
    process.exit(1);
  }
  console.log(await hashPassword(password));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
