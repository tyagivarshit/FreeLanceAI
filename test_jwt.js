const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// We just test if our token methods work.
const token = jwt.sign({ userId: '123', email: 'test@example.com', scope: 'extension' }, 'secret', { algorithm: 'HS256', expiresIn: '12h' });
const decoded = jwt.verify(token, 'secret', { algorithms: ['HS256'] });
console.log(decoded);
