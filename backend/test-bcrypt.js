const bcrypt = require('bcrypt');

async function test() {
  const password = '*Amell.Max1#';
  const hash = await bcrypt.hash(password, 12);
  console.log('Generated hash:', hash);
  const match = await bcrypt.compare(password, hash);
  console.log('Verify match:', match);
}

test();
