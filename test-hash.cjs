const crypto = require('crypto');
const storedHash = 'f4a8baab655570cf5fbc4ca9cbfe2df1:c1fae4cad2fb3d2888c821fbe5dfce25d63bb02f95fe3a8ccc9fd07409a8c7cf4f42d4db41a8c262dce0fb54f1ab34858a76857973c45c47bedc33faf34fb6bb';
const [salt, hash] = storedHash.split(':');
const derived = crypto.scryptSync('password123', salt, 64, { N: 16384, r: 8, p: 1 });
const result = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived);
console.log('verifyPassword("password123", passwordHash) === ' + result);
