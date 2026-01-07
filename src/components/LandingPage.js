// New Landing Page Component
// Marketing/landing UI only - no analysis execution

function createLandingPage() {
  return `
    <div id="landing-page" class="landing-page">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-container">
          <div class="hero-content">
            <div class="hero-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              Stand out from the competition
            </div>
            
            <h1 class="hero-title">
              Land Your Dream Job with
              <span class="hero-highlight">Confidence</span>
            </h1>
            
            <p class="hero-description">
              Transform your resume into interview-winning applications. Our AI analyzes job descriptions and creates personalized materials that get you noticed.
            </p>
            
            <button class="hero-cta" onclick="switchToTab('analyze')">
              Analyze Your Resume Now
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14m-7-7l7 7-7 7"/>
              </svg>
            </button>
            
            <!-- Stats -->
            <div class="hero-stats">
              <div class="stat">
                <div class="stat-number">94%</div>
                <div class="stat-label">Success Rate</div>
              </div>
              <div class="stat">
                <div class="stat-number">2.5x</div>
                <div class="stat-label">More Interviews</div>
              </div>
              <div class="stat">
                <div class="stat-number">50k+</div>
                <div class="stat-label">Jobs Matched</div>
              </div>
            </div>
          </div>
          
          <!-- Resume Preview Card -->
          <div class="hero-preview">
            <div class="preview-card">
              <h3 class="preview-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
                Resume vs Job Description
              </h3>
              
              <div class="preview-uploads">
                <div class="upload-preview" onclick="switchToTab('analyze')">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  <p>Upload Your Resume</p>
                  <span>PDF, DOC, or DOCX</span>
                </div>
                
                <div class="upload-preview" onclick="switchToTab('analyze')">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  <p>Paste Job Description</p>
                  <span>Copy from job posting</span>
                </div>
              </div>
              
              <button class="preview-cta" onclick="switchToTab('analyze')">
                Get Your Match Score
              </button>
            </div>
            
            <!-- Free Badge -->
            <div class="free-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <path d="M22 4L12 14.01l-3-3"/>
              </svg>
              Free Analysis
            </div>
          </div>
        </div>
      </section>
      
      <!-- Features Section -->
      <section class="features-section">
        <div class="features-container">
          <div class="features-header">
            <h2>Everything You Need to Stand Out</h2>
            <p>One analysis, four powerful tools to accelerate your job search</p>
          </div>
          
          <div class="features-grid">
            <div class="feature-card" onclick="switchToTab('analyze')">
              <div class="feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3>Match Score</h3>
              <p>Get an instant compatibility score between your resume and job description</p>
            </div>
            
            <div class="feature-card" onclick="switchToTab('analyze')">
              <div class="feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
              </div>
              <h3>Cover Letter</h3>
              <p>Generate tailored cover letters that highlight your relevant experience</p>
            </div>
            
            <div class="feature-card" onclick="switchToTab('networking')">
              <div class="feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <h3>Referral Messages</h3>
              <p>Craft compelling messages to request referrals from your network</p>
            </div>
            
            <div class="feature-card" onclick="switchToTab('analyze')">
              <div class="feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <h3>Elevator Pitch</h3>
              <p>Create a powerful 30-second pitch customized for each opportunity</p>
            </div>
          </div>
        </div>
      </section>
      
      <!-- How It Works Section -->
      <section class="how-it-works-section">
        <div class="how-it-works-container">
          <h2>Simple. Fast. Effective.</h2>
          
          <div class="steps-grid">
            <div class="step">
              <div class="step-number">1</div>
              <h3>Upload & Paste</h3>
              <p>Submit your resume and target job description</p>
            </div>
            
            <div class="step">
              <div class="step-number">2</div>
              <h3>AI Analysis</h3>
              <p>Get instant compatibility score and insights</p>
            </div>
            
            <div class="step">
              <div class="step-number">3</div>
              <h3>Generate Materials</h3>
              <p>Create cover letter, pitch, and referral messages</p>
            </div>
          </div>
          
          <button class="cta-button" onclick="switchToTab('analyze')">
            Start Your Free Analysis
          </button>
        </div>
      </section>
      
      <!-- Footer -->
      <footer class="landing-footer">
        <div class="footer-container">
          <p>&copy; 2024 CareerMatch. Your partner in career success.</p>
        </div>
      </footer>
    </div>
  `;
}
