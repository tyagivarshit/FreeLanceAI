import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
export class StorageClient {
    client;
    bucket;
    constructor(config) {
        this.bucket = config.bucketName;
        const isMinio = Boolean(config.endpoint?.includes('localhost'));
        this.client = new S3Client({
            region: config.region || "auto",
            endpoint: config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            forcePathStyle: isMinio, // Required for MinIO
        });
    }
    async uploadFile(key, body, contentType) {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        });
        await this.client.send(command);
    }
    async deleteFile(key) {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        await this.client.send(command);
    }
    async getDownloadUrl(key, expiresInSeconds = 3600) {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    }
}
