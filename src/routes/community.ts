import { Router, Request, Response } from 'express';
import { getPool } from '../database/connection';
import { AnalyticsService } from '../services/analyticsService';

const router = Router();

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: any) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    (req as any).userId = userId;
    next();
};

// ========== POST ROUTES ==========

// Get all posts with filtering and sorting (no auth required for browsing)
router.get('/posts', async (req: Request, res: Response) => {
    const { category, tags, sort = 'recent', limit = 20, offset = 0 } = req.query;

    try {
        const pool = getPool();
        let query = `
      SELECT 
        p.*,
        u.full_name as author_name,
        u.email as author_email,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', l.id, 'user_id', l.user_id)
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'
        ) as likes
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN community_likes l ON p.id = l.post_id
      WHERE p.is_flagged = false
    `;

        const params: any[] = [];
        let paramIndex = 1;

        // Filter by category
        if (category && category !== 'all') {
            query += ` AND p.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        // Filter by tags
        if (tags && typeof tags === 'string') {
            const tagArray = tags.split(',');
            query += ` AND p.tags && $${paramIndex}::text[]`;
            params.push(tagArray);
            paramIndex++;
        }

        query += ' GROUP BY p.id, u.full_name, u.email';

        // Sorting
        switch (sort) {
            case 'popular':
                query += ' ORDER BY p.like_count DESC, p.created_at DESC';
                break;
            case 'trending':
                // Trending: combination of recent + engagement
                query += ` ORDER BY (p.like_count + p.comment_count * 2) / EXTRACT(EPOCH FROM (NOW() - p.created_at) / 3600 + 2) DESC`;
                break;
            case 'recent':
            default:
                query += ' ORDER BY p.created_at DESC';
        }

        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const result = await pool.query(query, params);

        // Get total count for pagination
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM community_posts WHERE is_flagged = false'
        );

        res.json({
            success: true,
            posts: result.rows.map((row: any) => ({
                ...row,
                author_name: row.is_anonymous ? 'Anonymous' : row.author_name,
                author_email: row.is_anonymous ? null : row.author_email,
            })),
            total: parseInt(countResult.rows[0].count),
            hasMore: parseInt(offset as string) + result.rows.length < parseInt(countResult.rows[0].count),
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch posts' });
    }
});

// Get single post with comments
router.get('/posts/:postId', async (req: Request, res: Response) => {
    const { postId } = req.params;

    try {
        const pool = getPool();

        // Increment view count
        await pool.query(
            'UPDATE community_posts SET view_count = view_count + 1 WHERE id = $1',
            [postId]
        );

        // Get post
        const postResult = await pool.query(
            `SELECT 
        p.*,
        u.full_name as author_name,
        u.email as author_email
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = $1`,
            [postId]
        );

        if (postResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        const post = postResult.rows[0];

        // Get comments
        const commentsResult = await pool.query(
            `SELECT 
        c.*,
        u.full_name as author_name,
        u.email as author_email
      FROM community_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC`,
            [postId]
        );

        res.json({
            success: true,
            post: {
                ...post,
                author_name: post.is_anonymous ? 'Anonymous' : post.author_name,
                author_email: post.is_anonymous ? null : post.author_email,
            },
            comments: commentsResult.rows,
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch post' });
    }
});

// Create new post
router.post('/posts', requireAuth, async (req: Request, res: Response) => {
    const { title, content, category, tags = [], isAnonymous = false } = req.body;
    const userId = (req as any).userId;

    if (!title || !content || !category) {
        return res.status(400).json({ success: false, error: 'Title, content, and category are required' });
    }

    try {
        const pool = getPool();

        const result = await pool.query(
            `INSERT INTO community_posts 
        (user_id, title, content, category, tags, is_anonymous)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
            [userId, title, content, category, tags, isAnonymous]
        );

        await AnalyticsService.logEvent({
            sessionId: userId,
            eventName: 'community_post_created',
            eventCategory: 'community',
            properties: { category, isAnonymous },
        });

        res.json({ success: true, post: result.rows[0] });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ success: false, error: 'Failed to create post' });
    }
});

// Update post
router.patch('/posts/:postId', requireAuth, async (req: Request, res: Response) => {
    const { postId } = req.params;
    const { title, content, category, tags } = req.body;
    const userId = (req as any).userId;

    try {
        const pool = getPool();

        // Check ownership
        const checkResult = await pool.query(
            'SELECT user_id FROM community_posts WHERE id = $1',
            [postId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized to edit this post' });
        }

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (title) {
            updates.push(`title = $${paramIndex}`);
            params.push(title);
            paramIndex++;
        }
        if (content) {
            updates.push(`content = $${paramIndex}`);
            params.push(content);
            paramIndex++;
        }
        if (category) {
            updates.push(`category = $${paramIndex}`);
            params.push(category);
            paramIndex++;
        }
        if (tags) {
            updates.push(`tags = $${paramIndex}`);
            params.push(tags);
            paramIndex++;
        }

        updates.push(`updated_at = NOW()`);
        params.push(postId);

        const result = await pool.query(
            `UPDATE community_posts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        res.json({ success: true, post: result.rows[0] });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ success: false, error: 'Failed to update post' });
    }
});

// Delete post
router.delete('/posts/:postId', requireAuth, async (req: Request, res: Response) => {
    const { postId } = req.params;
    const userId = (req as any).userId;

    try {
        const pool = getPool();

        // Check ownership
        const checkResult = await pool.query(
            'SELECT user_id FROM community_posts WHERE id = $1',
            [postId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this post' });
        }

        await pool.query('DELETE FROM community_posts WHERE id = $1', [postId]);

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ success: false, error: 'Failed to delete post' });
    }
});

// ========== COMMENT ROUTES ==========

// Get comments for a post
router.get('/posts/:postId/comments', async (req: Request, res: Response) => {
    const { postId } = req.params;

    try {
        const pool = getPool();

        const result = await pool.query(
            `SELECT 
        c.*,
        u.full_name as author_name,
        u.email as author_email
      FROM community_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1 AND c.is_flagged = false
      ORDER BY c.created_at ASC`,
            [postId]
        );

        res.json({ success: true, comments: result.rows });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch comments' });
    }
});

// Add comment
router.post('/posts/:postId/comments', requireAuth, async (req: Request, res: Response) => {
    const { postId } = req.params;
    const { content, parentCommentId = null } = req.body;
    const userId = (req as any).userId;

    if (!content) {
        return res.status(400).json({ success: false, error: 'Content is required' });
    }

    try {
        const pool = getPool();

        const result = await pool.query(
            `INSERT INTO community_comments 
        (post_id, user_id, parent_comment_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
            [postId, userId, parentCommentId, content]
        );

        // Update comment count on post
        await pool.query(
            'UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = $1',
            [postId]
        );

        await AnalyticsService.logEvent({
            sessionId: userId,
            eventName: 'community_comment_added',
            eventCategory: 'community',
            properties: { postId, hasParent: !!parentCommentId },
        });

        res.json({ success: true, comment: result.rows[0] });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, error: 'Failed to add comment' });
    }
});

// Update comment
router.patch('/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = (req as any).userId;

    try {
        const pool = getPool();

        // Check ownership
        const checkResult = await pool.query(
            'SELECT user_id FROM community_comments WHERE id = $1',
            [commentId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Comment not found' });
        }

        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized to edit this comment' });
        }

        const result = await pool.query(
            `UPDATE community_comments 
      SET content = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *`,
            [content, commentId]
        );

        res.json({ success: true, comment: result.rows[0] });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ success: false, error: 'Failed to update comment' });
    }
});

// Delete comment
router.delete('/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
    const { commentId } = req.params;
    const userId = (req as any).userId;

    try {
        const pool = getPool();

        // Check ownership
        const checkResult = await pool.query(
            'SELECT user_id, post_id FROM community_comments WHERE id = $1',
            [commentId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Comment not found' });
        }

        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this comment' });
        }

        const postId = checkResult.rows[0].post_id;

        await pool.query('DELETE FROM community_comments WHERE id = $1', [commentId]);

        // Update comment count on post
        await pool.query(
            'UPDATE community_posts SET comment_count = comment_count - 1 WHERE id = $1',
            [postId]
        );

        res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ success: false, error: 'Failed to delete comment' });
    }
});

// ========== LIKE ROUTES ==========

// Toggle like on post
router.post('/posts/:postId/like', requireAuth, async (req: Request, res: Response) => {
    const { postId } = req.params;
    const userId = (req as any).userId;

    try {
        const pool = getPool();

        // Check if already liked
        const existingLike = await pool.query(
            'SELECT id FROM community_likes WHERE user_id = $1 AND post_id = $2',
            [userId, postId]
        );

        if (existingLike.rows.length > 0) {
            // Unlike
            await pool.query(
                'DELETE FROM community_likes WHERE user_id = $1 AND post_id = $2',
                [userId, postId]
            );
            await pool.query(
                'UPDATE community_posts SET like_count = like_count - 1 WHERE id = $1',
                [postId]
            );
            res.json({ success: true, liked: false });
        } else {
            // Like
            await pool.query(
                'INSERT INTO community_likes (user_id, post_id) VALUES ($1, $2)',
                [userId, postId]
            );
            await pool.query(
                'UPDATE community_posts SET like_count = like_count + 1 WHERE id = $1',
                [postId]
            );
            res.json({ success: true, liked: true });
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle like' });
    }
});

// Toggle like on comment
router.post('/comments/:commentId/like', requireAuth, async (req: Request, res: Response) => {
    const { commentId } = req.params;
    const userId = (req as any).userId;

    try {
        const pool = getPool();

        // Check if already liked
        const existingLike = await pool.query(
            'SELECT id FROM community_likes WHERE user_id = $1 AND comment_id = $2',
            [userId, commentId]
        );

        if (existingLike.rows.length > 0) {
            // Unlike
            await pool.query(
                'DELETE FROM community_likes WHERE user_id = $1 AND comment_id = $2',
                [userId, commentId]
            );
            await pool.query(
                'UPDATE community_comments SET like_count = like_count - 1 WHERE id = $1',
                [commentId]
            );
            res.json({ success: true, liked: false });
        } else {
            // Like
            await pool.query(
                'INSERT INTO community_likes (user_id, comment_id) VALUES ($1, $2)',
                [userId, commentId]
            );
            await pool.query(
                'UPDATE community_comments SET like_count = like_count + 1 WHERE id = $1',
                [commentId]
            );
            res.json({ success: true, liked: true });
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle like' });
    }
});

// ========== FLAG/MODERATION ROUTES ==========

// Flag post
router.post('/posts/:postId/flag', requireAuth, async (req: Request, res: Response) => {
    const { postId } = req.params;
    const { reason, description = '' } = req.body;
    const userId = (req as any).userId;

    if (!reason) {
        return res.status(400).json({ success: false, error: 'Reason is required' });
    }

    try {
        const pool = getPool();

        await pool.query(
            `INSERT INTO community_flags (user_id, post_id, reason, description)
      VALUES ($1, $2, $3, $4)`,
            [userId, postId, reason, description]
        );

        // Increment flag count
        const result = await pool.query(
            `UPDATE community_posts 
      SET flag_count = flag_count + 1 
      WHERE id = $1 
      RETURNING flag_count`,
            [postId]
        );

        // Auto-hide if threshold reached (5 flags)
        if (result.rows[0].flag_count >= 5) {
            await pool.query(
                'UPDATE community_posts SET is_flagged = true WHERE id = $1',
                [postId]
            );
        }

        res.json({ success: true, message: 'Post flagged successfully' });
    } catch (error) {
        console.error('Error flagging post:', error);
        res.status(500).json({ success: false, error: 'Failed to flag post' });
    }
});

// Flag comment
router.post('/comments/:commentId/flag', requireAuth, async (req: Request, res: Response) => {
    const { commentId } = req.params;
    const { reason, description = '' } = req.body;
    const userId = (req as any).userId;

    if (!reason) {
        return res.status(400).json({ success: false, error: 'Reason is required' });
    }

    try {
        const pool = getPool();

        await pool.query(
            `INSERT INTO community_flags (user_id, comment_id, reason, description)
      VALUES ($1, $2, $3, $4)`,
            [userId, commentId, reason, description]
        );

        // Check flag count and auto-hide if needed
        const flagCount = await pool.query(
            'SELECT COUNT(*) FROM community_flags WHERE comment_id = $1',
            [commentId]
        );

        if (parseInt(flagCount.rows[0].count) >= 5) {
            await pool.query(
                'UPDATE community_comments SET is_flagged = true WHERE id = $1',
                [commentId]
            );
        }

        res.json({ success: true, message: 'Comment flagged successfully' });
    } catch (error) {
        console.error('Error flagging comment:', error);
        res.status(500).json({ success: false, error: 'Failed to flag comment' });
    }
});

// ========== USER ACTIVITY ROUTES ==========

// Get user's posts
router.get('/my-posts', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    try {
        const pool = getPool();

        const result = await pool.query(
            `SELECT * FROM community_posts 
      WHERE user_id = $1 
      ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ success: true, posts: result.rows });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch posts' });
    }
});

// Get user's activity (likes, comments)
router.get('/my-activity', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    try {
        const pool = getPool();

        // Get liked posts
        const likedPosts = await pool.query(
            `SELECT p.*, l.created_at as liked_at
      FROM community_posts p
      JOIN community_likes l ON p.id = l.post_id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT 20`,
            [userId]
        );

        // Get comments
        const comments = await pool.query(
            `SELECT c.*, p.title as post_title
      FROM community_comments c
      JOIN community_posts p ON c.post_id = p.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
      LIMIT 20`,
            [userId]
        );

        res.json({
            success: true,
            likedPosts: likedPosts.rows,
            comments: comments.rows,
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch activity' });
    }
});

export default router;
