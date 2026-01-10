import { logger } from '../utils/logger';

interface JobSearchCriteria {
    jobTitle: string;
    location: string;
    count?: number;
    datePosted?: 'any' | 'today' | 'week' | 'month';
}

/**
 * Service to interact with Apify API for LinkedIn Job Scraping
 * Uses the free/paid 'trudax/linkedin-job-scraper' or similar actor
 */
export const apifyService = {
    /**
     * Triggers an Apify Actor run
     */
    async startJobSearch(criteria: JobSearchCriteria, userId: string): Promise<string> {
        const apiToken = process.env.APIFY_API_TOKEN;

        // Default actor: 'hMvNSpz3JloGh5g5K' is 'linkedin-jobs-scraper' (example ID, we usually use the name 'trudax/linkedin-job-scraper')
        // Let's use the Actor ID explicitly if we know it, or name. 
        // For now I'll use a placeholder const for the recommended free/cheap scraper.
        // 'kfiWxiIPwaRI52gqH' -> 'trudax/linkedin-job-scraper' is a popular one.
        const ACTOR_ID = 'trudax/linkedin-job-scraper';

        if (!apiToken) {
            throw new Error('Apify configuration missing (APIFY_API_TOKEN)');
        }

        try {
            logger.info('Starting Apify job search', { userId, criteria });

            // Map datePosted to daysPublished (approximate)
            let daysPublished = 30; // default to month roughly
            if (criteria.datePosted === 'today') daysPublished = 1;
            else if (criteria.datePosted === 'week') daysPublished = 7;
            else if (criteria.datePosted === 'month') daysPublished = 30;
            else if (criteria.datePosted === 'any') daysPublished = 365;

            const input = {
                queries: [
                    `${criteria.jobTitle} in ${criteria.location}`
                ],
                locations: [criteria.location],
                keywords: [criteria.jobTitle],
                limit: criteria.count || 20,
                daysPublished: daysPublished
            };

            const response = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apiToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(input),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Apify API error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const runId = data.data.id;

            logger.info('Apify job search started', { runId, userId });

            return runId;
        } catch (error) {
            logger.error('Failed to start Apify job search', error);
            throw error;
        }
    },

    /**
     * Polls Apify for run status
     */
    async getRunStatus(runId: string): Promise<{ status: string; data?: any[] }> {
        const apiToken = process.env.APIFY_API_TOKEN;
        if (!apiToken) throw new Error('APIFY_API_TOKEN missing');

        // 1. Check Run Status
        const runRes = await fetch(`https://api.apify.com/v2/acts/runs/${runId}?token=${apiToken}`, { method: 'GET' });
        if (!runRes.ok) throw new Error(`Failed to get run status: ${runRes.status}`);

        const runData = await runRes.json();
        const status = runData.data.status; // SUCCEEDED, RUNNING, FAILED

        if (status === 'SUCCEEDED') {
            // 2. Fetch Results from Dataset
            const datasetId = runData.data.defaultDatasetId;
            const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`, { method: 'GET' });
            const results = await datasetRes.json();
            return { status, data: results };
        }

        return { status };
    }
};
