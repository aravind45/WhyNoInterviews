// ========== COMMUNITY FEATURE JAVASCRIPT ==========

// Community state
let communityCurrentFilter = 'all';
let communityCurrentOffset = 0;
const communityPageSize = 20;
let communityHasMore = false;

// Initialize community when tab is shown
function initializeCommunity() {
    loadCommunityPosts();
}

// Load community posts
async function loadCommunityPosts(append = false) {
    const feedEl = document.getElementById('community-feed');
    const loadingEl = document.getElementById('community-loading');
    const emptyEl = document.getElementById('community-empty');
    const loadMoreEl = document.getElementById('community-load-more');
    const sortEl = document.getElementById('community-sort');

    if (!append) {
        communityCurrentOffset = 0;
        feedEl.innerHTML = '';
    }

    loadingEl.style.display = 'block';
    emptyEl.style.display = 'none';
    loadMoreEl.style.display = 'none';

    try {
        const params = new URLSearchParams({
            category: communityCurrentFilter,
            sort: sortEl.value,
            limit: communityPageSize.toString(),
            offset: communityCurrentOffset.toString(),
        });

        const response = await fetch(`/api/community/posts?${params}`, {
            headers: {
                'x-user-id': currentUser?.id || localStorage.getItem('jobmatch_session') || '',
            },
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load posts');
        }

        loadingEl.style.display = 'none';

        if (data.posts.length === 0 && !append) {
            emptyEl.style.display = 'block';
            return;
        }

        data.posts.forEach(post => {
            feedEl.appendChild(createPostCard(post));
        });

        communityHasMore = data.hasMore;
        communityCurrentOffset += data.posts.length;

        if (communityHasMore) {
            loadMoreEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        loadingEl.style.display = 'none';
        showToast('Failed to load posts. Please try again.', 'error');
    }
}

// Create post card
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'cursor: pointer; transition: all 0.2s ease; border-left: 4px solid ' + getCategoryColor(post.category);

    const categoryEmoji = getCategoryEmoji(post.category);
    const timeAgo = getTimeAgo(new Date(post.created_at));

    card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="background: ${getCategoryBg(post.category)}; color: ${getCategoryColor(post.category)}; padding: 4px 12px; border-radius: 50px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">
            ${categoryEmoji} ${post.category.replace('_', ' ')}
          </span>
          ${post.is_anonymous ? '<span style="color: #64748B; font-size: 0.85rem;">Anonymous</span>' : `<span style="color: #64748B; font-size: 0.85rem;">by ${post.author_name}</span>`}
          <span style="color: #94A3B8; font-size: 0.85rem;">• ${timeAgo}</span>
        </div>
        <h3 style="font-size: 1.2rem; font-weight: 700; color: #1E293B; margin-bottom: 8px;">${escapeHtml(post.title)}</h3>
        <p style="color: #475569; line-height: 1.6; margin-bottom: 12px;">${truncateText(escapeHtml(post.content), 200)}</p>
        ${post.tags && post.tags.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
            ${post.tags.map(tag => `<span class="tag" style="background: #F1F5F9; color: #475569; padding: 4px 10px; border-radius: 50px; font-size: 0.75rem;">#${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 20px; color: #64748B; font-size: 0.9rem;">
      <span onclick="event.stopPropagation(); togglePostLike('${post.id}')" style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
        <span id="like-icon-${post.id}">${post.user_has_liked ? '❤️' : '🤍'}</span>
        <span id="like-count-${post.id}">${post.like_count || 0}</span>
      </span>
      <span style="display: flex; align-items: center; gap: 6px;">
        💬 ${post.comment_count || 0}
      </span>
      <span style="display: flex; align-items: center; gap: 6px;">
        👁️ ${post.view_count || 0}
      </span>
    </div>
  `;

    card.onclick = () => openPostDetail(post.id);

    return card;
}

// Filter community posts
function filterCommunity(category) {
    communityCurrentFilter = category;

    // Update button states
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        btn.style.background = '';
        btn.style.color = '';
    });

    const activeBtn = document.getElementById(`filter-${category}`);
    if (activeBtn) {
        activeBtn.classList.remove('btn-secondary');
        activeBtn.classList.add('btn-primary');
        activeBtn.style.background = '#FF9500';
        activeBtn.style.color = 'white';
    }

    loadCommunityPosts();
}

// Load more posts
function loadMorePosts() {
    loadCommunityPosts(true);
}

// Show create post modal
function showCreatePostModal() {
    if (!currentUser && !localStorage.getItem('jobmatch_session')) {
        showToast('Please sign in to create a post', 'error');
        openAuthModal('login');
        return;
    }

    const modal = document.getElementById('create-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset form
        document.getElementById('create-post-form').reset();
    }
}

// Close create post modal
function closeCreatePostModal() {
    const modal = document.getElementById('create-post-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Submit community post
async function submitCommunityPost(event) {
    event.preventDefault();

    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    const category = document.getElementById('post-category').value;
    const tagsInput = document.getElementById('post-tags').value;
    const isAnonymous = document.getElementById('post-anonymous').checked;

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    const submitBtn = document.getElementById('submit-post-btn');
    const submitText = document.getElementById('submit-post-text');
    const submitLoading = document.getElementById('submit-post-loading');

    submitBtn.disabled = true;
    submitText.style.display = 'none';
    submitLoading.style.display = 'inline-block';

    try {
        const response = await fetch('/api/community/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser?.id || localStorage.getItem('jobmatch_session') || '',
            },
            body: JSON.stringify({
                title,
                content,
                category,
                tags,
                isAnonymous,
            }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to create post');
        }

        showToast('Post created successfully!', 'success');
        closeCreatePostModal();
        loadCommunityPosts(); // Reload feed
    } catch (error) {
        console.error('Error creating post:', error);
        showToast(error.message || 'Failed to create post', 'error');
    } finally {
        submitBtn.disabled = false;
        submitText.style.display = 'inline';
        submitLoading.style.display = 'none';
    }
}

// Open post detail
async function openPostDetail(postId) {
    const modal = document.getElementById('post-detail-modal');
    const titleEl = document.getElementById('detail-post-title');
    const contentEl = document.getElementById('post-detail-content');

    if (!modal) return;

    modal.style.display = 'flex';
    contentEl.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`/api/community/posts/${postId}`, {
            headers: {
                'x-user-id': currentUser?.id || localStorage.getItem('jobmatch_session') || '',
            },
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load post');
        }

        const post = data.post;
        const comments = data.comments || [];

        titleEl.textContent = post.title;

        const categoryEmoji = getCategoryEmoji(post.category);
        const timeAgo = getTimeAgo(new Date(post.created_at));

        contentEl.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <span style="background: ${getCategoryBg(post.category)}; color: ${getCategoryColor(post.category)}; padding: 6px 14px; border-radius: 50px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">
            ${categoryEmoji} ${post.category.replace('_', ' ')}
          </span>
          ${post.is_anonymous ? '<span style="color: #64748B;">Anonymous</span>' : `<span style="color: #64748B;">by ${post.author_name}</span>`}
          <span style="color: #94A3B8;">• ${timeAgo}</span>
        </div>
        <div style="color: #1E293B; line-height: 1.8; white-space: pre-wrap;">${escapeHtml(post.content)}</div>
        ${post.tags && post.tags.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px;">
            ${post.tags.map(tag => `<span class="tag" style="background: #F1F5F9; color: #475569; padding: 6px 12px; border-radius: 50px; font-size: 0.85rem;">#${tag}</span>`).join('')}
          </div>
        ` : ''}
        <div style="display: flex; align-items: center; gap: 24px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #E2E8F0;">
          <button onclick="togglePostLike('${post.id}')" class="btn btn-sm" style="display: flex; align-items: center; gap: 8px;">
            <span id="like-icon-${post.id}">${post.user_has_liked ? '❤️' : '🤍'}</span>
            <span id="like-count-${post.id}">${post.like_count || 0} Likes</span>
          </button>
          <span style="color: #64748B;">💬 ${post.comment_count || 0} Comments</span>
          <span style="color: #64748B;">👁️ ${post.view_count || 0} Views</span>
        </div>
      </div>

      <div style="border-top: 2px solid #E2E8F0; padding-top: 24px;">
        <h3 style="margin-bottom: 20px; color: #1E293B;">Comments (${comments.length})</h3>
        
        <form onsubmit="submitComment(event, '${postId}')" style="margin-bottom: 24px;">
          <textarea id="comment-input-${postId}" placeholder="Add a comment..." required
            style="width: 100%; min-height: 80px; padding: 12px; background: white; border: 2px solid #E2E8F0; border-radius: 12px; color: #1E293B; font-family: inherit; resize: vertical; margin-bottom: 12px;"></textarea>
          <button type="submit" class="btn btn-primary">Post Comment</button>
        </form>

        <div id="comments-list-${postId}" style="display: flex; flex-direction: column; gap: 16px;">
          ${comments.length === 0 ? '<p style="text-align: center; color: #94A3B8; padding: 40px;">No comments yet. Be the first to comment!</p>' : comments.map(comment => createCommentHTML(comment, postId)).join('')}
        </div>
      </div>
    `;
    } catch (error) {
        console.error('Error loading post:', error);
        contentEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;">Failed to load post details</div>';
    }
}

// Close post detail modal
function closePostDetailModal() {
    const modal = document.getElementById('post-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Create comment HTML
function createCommentHTML(comment, postId) {
    const timeAgo = getTimeAgo(new Date(comment.created_at));
    return `
    <div class="card" style="background: #F8FAFC; border: 1px solid #E2E8F0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="font-weight: 600; color: #1E293B;">${comment.author_name}</div>
        <div style="color: #94A3B8; font-size: 0.85rem;">${timeAgo}</div>
      </div>
      <div style="color: #475569; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(comment.content)}</div>
      <div style="margin-top: 12px; display: flex; align-items: center; gap: 16px;">
        <button onclick="toggleCommentLike('${comment.id}')" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; color: #64748B; font-size: 0.9rem;">
          <span id="comment-like-icon-${comment.id}">${comment.user_has_liked ? '❤️' : '🤍'}</span>
          <span id="comment-like-count-${comment.id}">${comment.like_count || 0}</span>
        </button>
      </div>
    </div>
  `;
}

// Submit comment
async function submitComment(event, postId) {
    event.preventDefault();

    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();

    if (!content) return;

    if (!currentUser && !localStorage.getItem('jobmatch_session')) {
        showToast('Please sign in to comment', 'error');
        openAuthModal('login');
        return;
    }

    try {
        const response = await fetch(`/api/community/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser?.id || localStorage.getItem('jobmatch_session') || '',
            },
            body: JSON.stringify({ content }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to add comment');
        }

        showToast('Comment added!', 'success');
        input.value = '';

        // Reload post detail to show new comment
        openPostDetail(postId);
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast(error.message || 'Failed to add comment', 'error');
    }
}

// Toggle post like
async function togglePostLike(postId) {
    if (!currentUser && !localStorage.getItem('jobmatch_session')) {
        showToast('Please sign in to like posts', 'error');
        openAuthModal('login');
        return;
    }

    try {
        const response = await fetch(`/api/community/posts/${postId}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser?.id || localStorage.getItem('jobmatch_session') || '',
            },
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to toggle like');
        }

        // Update UI
        const iconEl = document.getElementById(`like-icon-${postId}`);
        const countEl = document.getElementById(`like-count-${postId}`);

        if (iconEl && countEl) {
            iconEl.textContent = data.liked ? '❤️' : '🤍';
            const currentCount = parseInt(countEl.textContent) || 0;
            countEl.textContent = data.liked ? currentCount + 1 : Math.max(0, currentCount - 1);
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to update like', 'error');
    }
}

// Toggle comment like
async function toggleCommentLike(commentId) {
    if (!currentUser && !localStorage.getItem('jobmatch_session')) {
        showToast('Please sign in to like comments', 'error');
        openAuthModal('login');
        return;
    }

    try {
        const response = await fetch(`/api/community/comments/${commentId}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser?.id || localStorage.getItem('jobmatch_session') || '',
            },
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to toggle like');
        }

        // Update UI
        const iconEl = document.getElementById(`comment-like-icon-${commentId}`);
        const countEl = document.getElementById(`comment-like-count-${commentId}`);

        if (iconEl && countEl) {
            iconEl.textContent = data.liked ? '❤️' : '🤍';
            const currentCount = parseInt(countEl.textContent) || 0;
            countEl.textContent = data.liked ? currentCount + 1 : Math.max(0, currentCount - 1);
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to update like', 'error');
    }
}

// Helper functions
function getCategoryColor(category) {
    const colors = {
        success_story: '#10B981',
        question: '#3B82F6',
        advice: '#F59E0B',
        vent: '#8B5CF6',
        resource: '#06B6D4',
    };
    return colors[category] || '#64748B';
}

function getCategoryBg(category) {
    const bgs = {
        success_story: '#D1FAE5',
        question: '#DBEAFE',
        advice: '#FEF3C7',
        vent: '#EDE9FE',
        resource: '#CFFAFE',
    };
    return bgs[category] || '#F1F5F9';
}

function getCategoryEmoji(category) {
    const emojis = {
        success_story: '🎉',
        question: '❓',
        advice: '💡',
        vent: '😤',
        resource: '📚',
    };
    return emojis[category] || '💬';
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize community when switching to the tab
document.addEventListener('DOMContentLoaded', function () {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function (tabName) {
        if (originalSwitchTab) {
            originalSwitchTab(tabName);
        }
        if (tabName === 'community') {
            initializeCommunity();
        }
    };
});
