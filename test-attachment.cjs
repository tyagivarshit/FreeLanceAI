const fs = require("fs");
const path = require("path");

async function run() {
  const email = `test-${Date.now()}@example.com`;
  const password = "SuperSecretPassword123!";

  console.log("1. Signup user...");
  const signupRes = await fetch("http://localhost:4000/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "Test", lastName: "User" })
  });
  
  if (!signupRes.ok) {
    console.error("Signup failed", await signupRes.text());
    return;
  }
  const cookies = signupRes.headers.get("set-cookie");
  const authHeader = { "Cookie": cookies || "" };
  console.log("Signup success!");

  console.log("2. Create valid PDF...");
  const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  const pdfContent = Buffer.concat([pdfMagic, Buffer.alloc(1024, "A")]);
  
  const form1 = new FormData();
  form1.append("file", new Blob([pdfContent]), "valid.pdf");
  form1.append("metadata", JSON.stringify({ reference: "my-valid-pdf" }));
  
  console.log("3. Upload valid file...");
  const up1 = await fetch("http://localhost:4000/api/attachments", {
    method: "POST",
    headers: { ...authHeader },
    body: form1
  });
  const up1Body = await up1.json();
  console.log("Upload 1:", up1.status, up1Body);

  console.log("4. Upload oversized file (>25MB)...");
  // Just simulate limits via busboy (since our max is 25MB). Actually generating a 26MB file takes disk space,
  // let's do 26MB!
  const hugeBuf = Buffer.alloc(26 * 1024 * 1024, "A");
  const form2 = new FormData();
  form2.append("file", new Blob([hugeBuf]), "huge.txt");
  const up2 = await fetch("http://localhost:4000/api/attachments", {
    method: "POST",
    headers: { ...authHeader },
    body: form2
  });
  console.log("Upload oversized:", up2.status, await up2.json());

  console.log("5. Upload spoofed extension (text file named .png)...");
  const spoofContent = Buffer.from("this is just text, not a png");
  const form3 = new FormData();
  form3.append("file", new Blob([spoofContent]), "spoofed.png");
  const up3 = await fetch("http://localhost:4000/api/attachments", {
    method: "POST",
    headers: { ...authHeader },
    body: form3
  });
  console.log("Upload spoofed:", up3.status, await up3.json());

  console.log("6. Upload duplicate reference...");
  const form4 = new FormData();
  form4.append("file", new Blob([pdfContent]), "valid.pdf");
  form4.append("metadata", JSON.stringify({ reference: "my-valid-pdf" })); // Same ref!
  const up4 = await fetch("http://localhost:4000/api/attachments", {
    method: "POST",
    headers: { ...authHeader },
    body: form4
  });
  console.log("Upload duplicate:", up4.status, await up4.json());

  console.log("7. Cross-tenant test (simulate with wrong user)...");
  // Just test DELETE with wrong tenant by creating another user
  const email2 = `test2-${Date.now()}@example.com`;
  const signupRes2 = await fetch("http://localhost:4000/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email2, password, firstName: "T2", lastName: "U2" })
  });
  const cookies2 = signupRes2.headers.get("set-cookie");
  const authHeader2 = { "Cookie": cookies2 || "" };

  const delCross = await fetch("http://localhost:4000/api/attachments?id=" + up1Body.attachmentId, {
    method: "DELETE",
    headers: { ...authHeader2 }
  });
  console.log("Delete cross-tenant:", delCross.status, await delCross.json());

  console.log("8. Cascade delete (remove from R2/Minio)...");
  const delReal = await fetch("http://localhost:4000/api/attachments?id=" + up1Body.attachmentId, {
    method: "DELETE",
    headers: { ...authHeader }
  });
  console.log("Delete legitimate:", delReal.status, await delReal.json());
}
run();
