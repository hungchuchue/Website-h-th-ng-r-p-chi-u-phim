"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePresignedUploadUrl = generatePresignedUploadUrl;
exports.getPublicUrl = getPublicUrl;
exports.deleteObject = deleteObject;
exports.listObjects = listObjects;
exports.uploadBuffer = uploadBuffer;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const config_1 = require("../config");
let s3Client = null;
if (config_1.config.r2.accountId) {
    s3Client = new client_s3_1.S3Client({
        region: 'auto',
        endpoint: `https://${config_1.config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config_1.config.r2.accessKeyId,
            secretAccessKey: config_1.config.r2.secretAccessKey,
        },
    });
}
async function generatePresignedUploadUrl(key, contentType, fileSize) {
    if (!s3Client)
        throw new Error('R2 Client not properly configured');
    const command = new client_s3_1.PutObjectCommand({
        Bucket: config_1.config.r2.bucketName,
        Key: key,
        ContentType: contentType,
        ContentLength: fileSize
    });
    const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 300 }); // 5 minutes
    return {
        upload_url: uploadUrl,
        method: 'PUT',
        original_file_name: key,
        public_url: getPublicUrl(key)
    };
}
function getPublicUrl(key) {
    const publicUrlBase = config_1.config.r2.publicUrl.replace(/\/$/, ""); // trim trailing slash
    return `${publicUrlBase}/${key}`;
}
async function deleteObject(key) {
    if (!s3Client)
        return;
    try {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: config_1.config.r2.bucketName,
            Key: key
        });
        await s3Client.send(command);
    }
    catch (err) {
        console.error(`[R2] Failed to delete object ${key}:`, err.message);
    }
}
async function listObjects(prefix) {
    if (!s3Client)
        throw new Error('R2 is not configured');
    const command = new client_s3_1.ListObjectsV2Command({
        Bucket: config_1.config.r2.bucketName,
        Prefix: prefix
    });
    const response = await s3Client.send(command);
    return response.Contents || [];
}
async function uploadBuffer(key, buffer, contentType) {
    if (!s3Client)
        throw new Error('R2 Client not properly configured');
    const command = new client_s3_1.PutObjectCommand({
        Bucket: config_1.config.r2.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType
    });
    await s3Client.send(command);
    return getPublicUrl(key);
}
