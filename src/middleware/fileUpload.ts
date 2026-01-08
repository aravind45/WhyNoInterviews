import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { logger } from '../utils/logger';
import { ValidationError } from '../types';

// Configuration
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

// Ensure upload directory exists
const ensureUploadDir = (): void => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info(`Created upload directory: ${UPLOAD_DIR}`);
  }
};

ensureUploadDir();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `resume-${uniqueSuffix}${ext}`);
  },
});

// File filter - only used for basic sanity checks if any
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  cb(null, true);
};

// Multer instance
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only one file per request
    fields: 10, // Max form fields
    parts: 15, // Max multipart parts
  },
});

// File validation result
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    originalName: string;
    size: number;
    mimetype: string;
    extension: string;
    path: string;
  };
}

// Validate uploaded file
export const validateUploadedFile = (file: Express.Multer.File): FileValidationResult => {
  const result: FileValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!file) {
    result.isValid = false;
    result.errors.push('No file uploaded');
    return result;
  }

  const ext = path.extname(file.originalname).toLowerCase();

  // Extension validation
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    result.isValid = false;
    result.errors.push(`Unsupported file type`);
  }

  // MIME type validation
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    result.isValid = false;
    // Only push if not already marked as invalid by extension
    if (result.isValid) {
      result.errors.push(`Unsupported file type`);
    }
  }

  // Size validation
  if (file.size === 0) {
    result.isValid = false;
    result.errors.push('File is empty');
  } else if (file.size > MAX_FILE_SIZE) {
    result.isValid = false;
    result.errors.push(`File size exceeds maximum allowed limit`);
  }

  // Size warnings
  if (file.size > 0 && file.size < 1000) {
    result.warnings.push('File seems very small. Please ensure it contains your complete resume.');
  }

  if (file.size > 5 * 1024 * 1024) {
    result.warnings.push('Large file detected. Processing may take longer.');
  }

  // Filename validation
  if (file.originalname.length > 255) {
    result.warnings.push('Filename is very long. Consider using a shorter name.');
  }

  // Check for suspicious patterns
  if (/[<>:"/\\|?*]/.test(file.originalname)) {
    result.warnings.push('Filename contains special characters that may cause issues.');
  }

  if (result.isValid) {
    result.fileInfo = {
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      extension: ext,
      path: file.path,
    };
  }

  return result;
};

// Clean up temporary file
export const cleanupTempFile = async (filePath: string): Promise<void> => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.debug(`Cleaned up temp file: ${filePath}`);
    }
  } catch (error) {
    logger.error('Failed to cleanup temp file:', { filePath, error });
  }
};

/**
 * Encrypt file content using AES-256-GCM
 */
export const encryptFileContent = (content: Buffer, key: string): Buffer => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.scryptSync(key, 'salt', 32), iv);
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
};

/**
 * Decrypt file content using AES-256-GCM
 */
export const decryptFileContent = (encryptedContent: Buffer, key: string): Buffer => {
  const iv = encryptedContent.slice(0, 12);
  const authTag = encryptedContent.slice(12, 28);
  const encrypted = encryptedContent.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(key, 'salt', 32), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

// Calculate file hash for deduplication
export const calculateFileHash = (filePath: string): string => {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

// Cleanup old files periodically
export const cleanupOldFiles = async (maxAgeMs: number = 3600000): Promise<number> => {
  let cleaned = 0;

  try {
    if (!fs.existsSync(UPLOAD_DIR)) return 0;

    const files = await fs.promises.readdir(UPLOAD_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      try {
        const stats = await fs.promises.stat(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(filePath);
          cleaned++;
        }
      } catch (error) {
        logger.error('Error checking file age:', { filePath, error });
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old upload files`);
    }
  } catch (error) {
    logger.error('Error during file cleanup:', error);
  }

  return cleaned;
};

export default {
  uploadMiddleware,
  validateUploadedFile,
  cleanupTempFile,
  calculateFileHash,
  cleanupOldFiles,
};
