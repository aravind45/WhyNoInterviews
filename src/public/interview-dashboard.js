// Interview Dashboard Client-Side Logic

// Load dashboard data on page load
document.addEventListener('DOMContentLoaded', loadDashboard);

async function loadDashboard() {
  try {
    const response = await fetch('/api/mock-interview/interview-dashboard');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load dashboard');
    }

    const { interviews, summary, message } = data.data;

    // Hide loading
    document.getElementById('loading').style.display = 'none';

    // Show login message if not authenticated
    if (message) {
      showError(message);
      showEmptyState();
      return;
    }

    // Show empty state if no interviews
    if (!interviews || interviews.length === 0) {
      showEmptyState();
      return;
    }

    // Display dashboard content
    displaySummaryStats(summary);
    displayInterviews(interviews);
    document.getElementById('dashboard-content').style.display = 'block';
  } catch (error) {
    console.error('Error loading dashboard:', error);
    document.getElementById('loading').style.display = 'none';
    showError('Failed to load interview dashboard. Please try again.');
  }
}

function displaySummaryStats(summary) {
  document.getElementById('total-interviews').textContent = summary.totalInterviews || 0;
  document.getElementById('completed-interviews').textContent = summary.completedInterviews || 0;
  document.getElementById('average-score').textContent = summary.averageScore
    ? `${summary.averageScore}%`
    : '--';

  // Calculate days since last interview
  if (summary.lastInterviewDate) {
    const lastDate = new Date(summary.lastInterviewDate);
    const today = new Date();
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    document.getElementById('last-interview').textContent =
      diffDays === 0 ? 'Today' : `${diffDays}d ago`;
  } else {
    document.getElementById('last-interview').textContent = '--';
  }
}

function displayInterviews(interviews) {
  const container = document.getElementById('interviews-list');
  container.innerHTML = '';

  interviews.forEach((interview) => {
    const card = createInterviewCard(interview);
    container.appendChild(card);
  });
}

function createInterviewCard(interview) {
  const card = document.createElement('div');
  card.className = 'interview-card';

  const statusClass = getStatusClass(interview.status);
  const formattedDate = formatDate(interview.createdAt);
  const duration = interview.completedAt
    ? formatDuration(new Date(interview.completedAt) - new Date(interview.createdAt))
    : `${interview.duration} min planned`;

  card.innerHTML = `
        <div class="interview-header">
            <div class="interview-info">
                <div class="interview-title">${interview.jobRole}</div>
                <div class="interview-meta">
                    ${capitalizeFirst(interview.interviewType)} • ${formattedDate} • ${duration}
                </div>
                <span class="interview-status ${statusClass}">${interview.status}</span>
            </div>
        </div>
        
        ${
          interview.results
            ? `
            <div class="interview-scores">
                <div class="score-item">
                    <div class="score-value">${interview.results.overallScore}</div>
                    <div class="score-label">Overall</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${interview.results.categoryScores.communication}</div>
                    <div class="score-label">Communication</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${interview.results.categoryScores.technical}</div>
                    <div class="score-label">Technical</div>
                </div>
                <div class="score-item">
                    <div class="score-value">${interview.results.categoryScores.confidence}</div>
                    <div class="score-label">Confidence</div>
                </div>
            </div>
        `
            : `
            <div style="text-align: center; padding: 20px; color: #64748b; font-style: italic;">
                ${interview.status === 'completed' ? 'Results processing...' : 'Interview not completed'}
            </div>
        `
        }
        
        <div class="interview-actions">
            ${
              interview.results
                ? `
                <button class="btn btn-secondary" onclick="viewResults('${interview.sessionToken}')">
                    View Results
                </button>
            `
                : ''
            }
            ${
              interview.status !== 'completed'
                ? `
                <button class="btn btn-primary" onclick="continueInterview('${interview.sessionToken}')">
                    Continue Interview
                </button>
            `
                : ''
            }
            <button class="btn btn-secondary" onclick="deleteInterview('${interview.id}')">
                Delete
            </button>
        </div>
    `;

  return card;
}

function getStatusClass(status) {
  switch (status) {
    case 'completed':
      return 'status-completed';
    case 'in_progress':
      return 'status-in-progress';
    case 'setup':
      return 'status-setup';
    default:
      return 'status-setup';
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatDuration(milliseconds) {
  const minutes = Math.floor(milliseconds / (1000 * 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function showEmptyState() {
  document.getElementById('empty-state').style.display = 'block';
}

// Action handlers
function viewResults(sessionToken) {
  // Open results in a new window/tab or modal
  window.open(`/mock-interview.html?results=${sessionToken}`, '_blank');
}

function continueInterview(sessionToken) {
  // Redirect to continue the interview
  window.location.href = `/mock-interview.html?continue=${sessionToken}`;
}

async function deleteInterview(interviewId) {
  if (!confirm('Are you sure you want to delete this interview? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`/api/mock-interview/interview-session/${interviewId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      // Reload the dashboard
      location.reload();
    } else {
      throw new Error('Failed to delete interview');
    }
  } catch (error) {
    console.error('Error deleting interview:', error);
    alert('Failed to delete interview. Please try again.');
  }
}

// Refresh dashboard every 30 seconds to catch any updates
setInterval(() => {
  if (document.getElementById('dashboard-content').style.display !== 'none') {
    loadDashboard();
  }
}, 30000);
