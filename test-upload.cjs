const { signAccessToken } = require('./packages/auth/dist/index.js');
const FormData = require('form-data');
const fs = require('fs');

async function sendUpload(form) {
  return new Promise((resolve, reject) => {
    form.submit({
      host: 'localhost',
      port: 4000,
      path: '/api/attachments',
      headers: { 'Authorization': 'Bearer ' + form.customToken }
    }, function(err, res) {
      if (err) return reject(err);
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        try { body = JSON.parse(body); } catch(e) {}
        resolve({ status: res.statusCode, body });
      });
    });
  });
}

async function runTests() {
  const tokenA = await signAccessToken({ userId: "11111111-1111-1111-1111-111111111111", sessionId: "sA", credentialVersion: 1 });
  const tokenB = await signAccessToken({ userId: "22222222-2222-2222-2222-222222222222", sessionId: "sB", credentialVersion: 1 });

  console.log("Tokens generated.");
  
  // 1. Valid upload
  const form1 = new FormData();
  form1.customToken = tokenA;
  form1.append('parentId', '33333333-3333-3333-3333-333333333333');
  form1.append('parentType', 'project');
  form1.append('attachmentReference', 'ref_901');
  
  fs.writeFileSync('valid.pdf', Buffer.from('%PDF-1.4\\n%EOF\\n'));
  form1.append('file', fs.createReadStream('valid.pdf'), { filename: 'valid.pdf', contentType: 'application/pdf' });

  console.log("Sending valid upload...");
  let res = await sendUpload(form1);
  console.log("Valid upload status:", res.status);
  console.log("Valid upload body:", res.body);

  // 2. Duplicate upload
  const form1dup = new FormData();
  form1dup.customToken = tokenA;
  form1dup.append('parentId', '33333333-3333-3333-3333-333333333333');
  form1dup.append('parentType', 'project');
  form1dup.append('attachmentReference', 'ref_901'); // same ref
  form1dup.append('file', fs.createReadStream('valid.pdf'), { filename: 'valid2.pdf', contentType: 'application/pdf' });
  
  console.log("Sending duplicate upload...");
  let resDup = await sendUpload(form1dup);
  console.log("Duplicate upload status:", resDup.status);
  console.log("Duplicate upload body:", resDup.body);

  // 3. Spoofed extension
  const form2 = new FormData();
  form2.customToken = tokenA;
  form2.append('parentId', '33333333-3333-3333-3333-333333333333');
  form2.append('parentType', 'project');
  form2.append('attachmentReference', 'ref_902');
  
  fs.writeFileSync('spoofed.jpg', Buffer.from('MZ\\x90\\x00\\x03\\x00\\x00\\x00')); // fake exe bytes
  form2.append('file', fs.createReadStream('spoofed.jpg'), { filename: 'spoofed.jpg', contentType: 'image/jpeg' });

  console.log("Sending spoofed upload...");
  let res2 = await sendUpload(form2);
  console.log("Spoofed upload status:", res2.status);
  console.log("Spoofed upload body:", res2.body);

  // 4. Oversized file
  const largeBuffer = Buffer.alloc(26 * 1024 * 1024, 'a');
  fs.writeFileSync('large.txt', largeBuffer);
  
  const form3 = new FormData();
  form3.customToken = tokenA;
  form3.append('parentId', '33333333-3333-3333-3333-333333333333');
  form3.append('parentType', 'project');
  form3.append('attachmentReference', 'ref_903');
  form3.append('file', fs.createReadStream('large.txt'), { filename: 'large.txt', contentType: 'text/plain' });

  console.log("Sending oversized upload...");
  try {
    let res3 = await sendUpload(form3);
    console.log("Oversized upload status:", res3.status);
    console.log("Oversized upload body:", res3.body);
  } catch(e) {
    console.log("Oversized upload failed as expected:", e.message);
  }

  // 5. Delete (and check isolation)
  const attachmentId = res.body.attachmentId || 'test-id';
  console.log("B deleting A's file...");
  let res4 = await fetch('http://localhost:4000/api/attachments/' + attachmentId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + tokenB }
  });
  console.log("B delete status:", res4.status);

  console.log("A deleting A's file...");
  let res5 = await fetch('http://localhost:4000/api/attachments/' + attachmentId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + tokenA }
  });
  console.log("A delete status:", res5.status);
  console.log("A delete body:", await res5.json());

}

runTests().catch(console.error);


