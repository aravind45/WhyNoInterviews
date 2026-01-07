import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/config - Public configuration endpoint
router.get('/config', (req: Request, res: Response) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        environment: process.env.NODE_ENV || 'development'
    });
});

export default router;
