const { S3Client, CreateBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function setupBucket() {
  const client = new S3Client({
    region: 'us-east-1',
    endpoint: 'http://localhost:9000',
    credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
    forcePathStyle: true
  });
  
  try {
    const { Buckets } = await client.send(new ListBucketsCommand({}));
    if (!Buckets.find(b => b.Name === 'freelanceos-attachments')) {
      await client.send(new CreateBucketCommand({ Bucket: 'freelanceos-attachments' }));
      console.log("Bucket created.");
    } else {
      console.log("Bucket already exists.");
    }
  } catch(e) {
    console.error("Bucket setup failed:", e);
  }
}
setupBucket();
