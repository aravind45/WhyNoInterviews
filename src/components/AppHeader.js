// New Professional Header Component
// Contains navigation + auth buttons

function createNewHeader() {
  return `
    <header class="new-header">
      <div class="new-header-content">
        <!-- Logo -->
        <div class="new-logo" onclick="goToHome()">
          <div class="new-logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <span class="new-logo-text">CareerMatch</span>
          <span class="new-badge">New</span>
        </div>

        <!-- Desktop Navigation -->
        <nav class="new-nav desktop-nav">
          <a href="#" class="new-nav-item" data-tab="analyze">Resume Analysis</a>
          <a href="#" class="new-nav-item" data-tab="optimizer">Resume Optimizer</a>
          <a href="#" class="new-nav-item" data-tab="search">Job Matching</a>
          <a href="#" class="new-nav-item" data-tab="target-companies">Target Companies</a>
          <a href="#" class="new-nav-item" data-tab="networking">Networking</a>
        </nav>

        <!-- Auth Buttons -->
        <div class="new-auth-buttons">
          <button class="new-btn new-btn-secondary" onclick="showAuthModal('login')">Log In</button>
          <button class="new-btn new-btn-primary" onclick="showAuthModal('signup')">Sign Up</button>
        </div>

        <!-- Mobile Menu Button -->
        <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Mobile Menu -->
      <div class="mobile-menu" id="mobile-menu">
        <div class="mobile-nav">
          <a href="#" class="mobile-nav-item" data-tab="analyze">Resume Analysis</a>
          <a href="#" class="mobile-nav-item" data-tab="optimizer">Resume Optimizer</a>
          <a href="#" class="mobile-nav-item" data-tab="search">Job Matching</a>
          <a href="#" class="mobile-nav-item" data-tab="target-companies">Target Companies</a>
          <a href="#" class="mobile-nav-item" data-tab="networking">Networking</a>
        </div>
        <div class="mobile-auth">
          <button class="new-btn new-btn-secondary mobile-btn" onclick="showAuthModal('login')">Log In</button>
          <button class="new-btn new-btn-primary mobile-btn" onclick="showAuthModal('signup')">Sign Up</button>
        </div>
      </div>
    </header>
  `;
}

// Header event handlers
function setupNewHeaderEvents() {
  // Navigation click handlers
  document.querySelectorAll('.new-nav-item, .mobile-nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const tab = this.getAttribute('data-tab');
      switchToTab(tab);
      closeMobileMenu();
    });
  });
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  menu.classList.toggle('open');
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  menu.classList.remove('open');
}

function goToHome() {
  // Switch to home/landing view
  showLandingPage();
}

function switchToTab(tabName) {
  // Remove active from all tabs
  document.querySelectorAll('.main-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Add active to selected tab
  const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  
  // Hide all sections
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Show target section
  const targetSection = document.getElementById(`tab-${tabName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }
  
  // Hide landing page if showing
  hideLandingPage();
}

function showLandingPage() {
  // Hide all app sections
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Show landing page
  const landingPage = document.getElementById('landing-page');
  if (landingPage) {
    landingPage.style.display = 'block';
  }
  
  // Remove active from all tabs
  document.querySelectorAll('.main-tab').forEach(tab => {
    tab.classList.remove('active');
  });
}

function hideLandingPage() {
  const landingPage = document.getElementById('landing-page');
  if (landingPage) {
    landingPage.style.display = 'none';
  }
}