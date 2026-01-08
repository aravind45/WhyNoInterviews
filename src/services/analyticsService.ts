import { query } from '../database/connection';
import { logger } from '../utils/logger';

export interface AnalyticsEvent {
    userId?: string;
    sessionId?: string;
    eventName: string;
    eventCategory: string;
    properties?: Record<string, any>;
    pageUrl?: string;
    referrer?: string;
    userAgent?: string;
    ipAddress?: string;
}

export class AnalyticsService {
    /**
     * Log an analytics event to the database
     */
    static async logEvent(event: AnalyticsEvent): Promise<void> {
        const {
            userId,
            sessionId,
            eventName,
            eventCategory,
            properties = {},
            pageUrl,
            referrer,
            userAgent,
            ipAddress,
        } = event;

        try {
            await query(
                `INSERT INTO analytics_events (
          user_id, session_id, event_name, event_category, 
          properties, page_url, referrer, user_agent, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    userId,
                    sessionId,
                    eventName,
                    eventCategory,
                    JSON.stringify(properties),
                    pageUrl,
                    referrer,
                    userAgent,
                    ipAddress,
                ]
            );
        } catch (error) {
            // We don't want analytics failures to break the main application flow
            logger.error('Failed to log analytics event:', { eventName, error });
        }
    }

    /**
     * Helper for page views
     */
    static async logPageView(sessionId: string, url: string, userId?: string, metadata?: any): Promise<void> {
        await this.logEvent({
            userId,
            sessionId,
            eventName: 'page_view',
            eventCategory: 'navigation',
            pageUrl: url,
            properties: metadata,
        });
    }

    /**
     * Helper for auth events
     */
    static async logAuthEvent(eventName: string, properties: any, sessionId?: string, userId?: string): Promise<void> {
        await this.logEvent({
            userId,
            sessionId,
            eventName,
            eventCategory: 'authentication',
            properties,
        });
    }
}

export default AnalyticsService;
