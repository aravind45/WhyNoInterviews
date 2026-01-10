import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { apifyService } from '../services/apifyService';
import { logger } from '../utils/logger';
import { ValidationError } from '../types';

const router = Router();

// POST /api/jobs/search - Start an Apify job search
router.post(
    '/search',
    asyncHandler(async (req: Request, res: Response) => {
        const { jobTitle, location, count, datePosted } = req.body;

        // We expect the user ID to be passed in headers if authenticated
        const userId = (req.headers['x-user-id'] as string) || 'anonymous';

        if (!jobTitle || !location) {
            throw new ValidationError('Job title and location are required');
        }

        // Call Apify instead of Gumloop
        const runId = await apifyService.startJobSearch(
            {
                jobTitle,
                location,
                count: count || 20,
                datePosted: datePosted || 'month'
            },
            userId
        );

        res.json({
            success: true,
            message: 'Job search started successfully',
            data: {
                runId,
                provider: 'apify',
                status: 'processing'
            }
        });
    })
);

// GET /api/jobs/status/:runId - Check status (Polling endpoint)
router.get(
    '/status/:runId',
    asyncHandler(async (req: Request, res: Response) => {
        const { runId } = req.params;
        // const userId = (req.headers['x-user-id'] as string) || 'anonymous';

        // Apify check status
        const result = await apifyService.getRunStatus(runId);

        res.json({
            success: true,
            data: result
        });
    })
);

export default router;
