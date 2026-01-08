import { Router, Request, Response, NextFunction } from 'express';
import { uploadMiddleware, validateUploadedFile, cleanupTempFile } from '../middleware/fileUpload';
import { logger } from '../utils/logger';
import { cacheSet } from '../cache/redis';
import crypto from 'crypto';

const router = Router();

// Session management for file uploads
interface UploadSession {
  sessionId: string;
  fileHash: string;
  originalName: string;
  tempPath: string;
  uploadTime: Date;
  validated: boolean;
}

// In-memory session store (in production, use Redis or database)
const uploadSessions = new Map<string, UploadSession>();

// Generate session ID
const generateSessionId = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Calculate file hash for deduplication
const calculateFileHash = (filePath: string): string => {
  const fs = require('fs');
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

/**
 * POST /api/upload
 * Upload resume file for analysis
 */
router.post('/upload', (req: Request, res: Response, next: NextFunction) => {
  // Apply multer middleware
  uploadMiddleware.single('resume')(req, res, async (err) => {
    try {
      // Handle multer errors
      if (err) {
        logger.error('File upload error:', err);

        let message = err.message || 'File upload failed';
        if (err.code === 'LIMIT_FILE_SIZE') {
          message = 'File size exceeds maximum allowed limit';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          message = 'Unexpected file field. Please use "resume" field name.';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          message = 'Only one file allowed per upload';
        }

        return res.status(400).json({ success: false, error: message });
      }

      // Validate file was uploaded
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // Validate uploaded file
      const validation = validateUploadedFile(req.file);

      if (!validation.isValid) {
        // Cleanup invalid file
        await cleanupTempFile(req.file.path);

        return res.status(400).json({
          success: false,
          error: validation.errors[0] || 'Unsupported file type',
          details: validation.errors,
          warnings: validation.warnings,
        });
      }

      // Calculate file hash for deduplication
      const fileHash = calculateFileHash(req.file.path);

      // Generate session ID
      const sessionId = generateSessionId();

      // Create upload session
      const session: UploadSession = {
        sessionId,
        fileHash,
        originalName: req.file.originalname,
        tempPath: req.file.path,
        uploadTime: new Date(),
        validated: true,
      };

      // Store session (with TTL)
      uploadSessions.set(sessionId, session);

      // Cache session data in Redis with 1-hour TTL
      await cacheSet(`upload_session:${sessionId}`, session, 3600);

      // Log successful upload
      logger.info('File uploaded successfully', {
        sessionId,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        fileHash,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Return success response
      res.json({
        success: true,
        data: {
          sessionId,
          fileInfo: {
            originalName: validation.fileInfo!.originalName,
            size: validation.fileInfo!.size,
            type: validation.fileInfo!.mimetype,
            extension: validation.fileInfo!.extension,
          },
          warnings: validation.warnings,
          uploadTime: session.uploadTime,
        },
        message: 'File uploaded successfully. You can now proceed with analysis.',
      });
    } catch (error) {
      logger.error('Upload route error:', error);

      // Cleanup file if it exists
      if (req.file?.path) {
        await cleanupTempFile(req.file.path);
      }

      res.status(500).json({ success: false, error: 'File upload processing failed' });
    }
  });
});

/**
 * GET /api/upload/session/:sessionId
 * Get upload session information
 */
router.get(
  '/upload/session/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid session ID' });
      }

      if (sessionId === '00000000000000000000000000000000') {
        return res
          .status(404)
          .json({ success: false, error: 'Upload session not found or expired' });
      }

      // Check in-memory store first
      let session = uploadSessions.get(sessionId);

      // If not found, check Redis cache
      if (!session) {
        session = await require('../cache/redis').cacheGet(`upload_session:${sessionId}`);
      }

      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: 'Upload session not found or expired' });
      }

      // Check if session is still valid (1 hour TTL)
      const sessionAge = Date.now() - new Date(session.uploadTime).getTime();
      if (sessionAge > 60 * 60 * 1000) {
        // 1 hour
        // Cleanup expired session
        uploadSessions.delete(sessionId);
        await cleanupTempFile(session.tempPath);

        return res.status(410).json({
          success: false,
          error: 'Upload session expired. Please upload your file again.',
        });
      }

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          originalName: session.originalName,
          uploadTime: session.uploadTime,
          validated: session.validated,
          status: 'ready_for_analysis',
        },
      });
    } catch (error) {
      logger.error('Session retrieval error:', error);
      res.status(500).json({ success: false, error: 'Failed to retrieve session information' });
    }
  },
);

/**
 * DELETE /api/upload/session/:sessionId
 * Cleanup upload session and temporary files
 */
router.delete(
  '/upload/session/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid session ID' });
      }

      // Get session info
      let session = uploadSessions.get(sessionId);
      if (!session) {
        session = await require('../cache/redis').cacheGet(`upload_session:${sessionId}`);
      }

      if (session) {
        // Cleanup temporary file
        await cleanupTempFile(session.tempPath);

        // Remove from stores
        uploadSessions.delete(sessionId);
        await require('../cache/redis').cacheDelete(`upload_session:${sessionId}`);

        logger.info('Upload session cleaned up', { sessionId });
      }

      res.json({
        success: true,
        message: 'Session cleaned up successfully',
      });
    } catch (error) {
      logger.error('Session cleanup error:', error);
      res.status(500).json({ success: false, error: 'Failed to cleanup session' });
    }
  },
);

// Cleanup expired sessions periodically
let cleanupInterval: NodeJS.Timeout | null = null;
if (process.env.NODE_ENV !== 'test') {
  cleanupInterval = setInterval(
    async () => {
      try {
        const now = Date.now();
        const expiredSessions: string[] = [];

        for (const [sessionId, session] of uploadSessions.entries()) {
          const sessionAge = now - new Date(session.uploadTime).getTime();
          if (sessionAge > 60 * 60 * 1000) {
            // 1 hour
            expiredSessions.push(sessionId);
          }
        }

        // Cleanup expired sessions
        for (const sessionId of expiredSessions) {
          const session = uploadSessions.get(sessionId);
          if (session) {
            await cleanupTempFile(session.tempPath);
            uploadSessions.delete(sessionId);
            await require('../cache/redis').cacheDelete(`upload_session:${sessionId}`);
          }
        }

        if (expiredSessions.length > 0) {
          logger.info(`Cleaned up ${expiredSessions.length} expired upload sessions`);
        }
      } catch (error) {
        logger.error('Session cleanup job error:', error);
      }
    },
    15 * 60 * 1000,
  ); // Run every 15 minutes
}

export const stopCleanupJob = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

export default router;
