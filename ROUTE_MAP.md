# Route Map - New UI Navigation

## Current Working Routes (Stable v1.0)

The new header navigation maps to these existing working sections:

| Navigation Item | Data Attribute | Target Section ID | Description |
|----------------|----------------|-------------------|-------------|
| Resume Analysis | `data-tab="analyze"` | `#tab-analyze` | Main resume analysis with file upload, job description input, and AI analysis |
| Resume Optimizer | `data-tab="optimizer"` | `#tab-optimizer` | Resume optimization tools and suggestions |
| Job Matching | `data-tab="search"` | `#tab-search` | Job search and matching functionality |
| Target Companies | `data-tab="target-companies"` | `#tab-target-companies` | Company targeting and tracking |
| Networking | `data-tab="networking"` | `#tab-networking` | ICA (Identify, Connect, Ask) networking tools |

## Auth Routes

| Button | Function | Description |
|--------|----------|-------------|
| Log In | `showAuthModal('login')` | Opens login modal with email/password form |
| Sign Up | `showAuthModal('signup')` | Opens signup modal with name/email/password form |

## Feature Flag Control

- **Environment Variable**: `NEXT_PUBLIC_NEW_UI=false` (default)
- **URL Parameter**: `?newui=true` (for testing)
- **LocalStorage**: `localStorage.setItem('NEXT_PUBLIC_NEW_UI', 'true')`

## UI Behavior

### When `newUI = false` (Default - Production Safe)
- Shows original dark theme UI
- Original header with emoji icons
- All existing functionality preserved
- No changes to user experience

### When `newUI = true` (New UI Enabled)
- Shows new professional light theme
- New CareerMatch landing page with hero section
- Professional header with clean navigation
- Landing page CTAs route to existing functional sections
- All backend functionality unchanged

## Landing Page CTA Mapping

| CTA Button | Target Action | Description |
|------------|---------------|-------------|
| "Analyze Your Resume Now" | `switchToTab('analyze')` | Routes to Resume Analysis section |
| "Get Your Match Score" | `switchToTab('analyze')` | Routes to Resume Analysis section |
| Feature cards | `switchToTab('analyze')` or appropriate section | Routes to relevant functional sections |

## Files Changed

1. `src/utils/featureFlags.js` - Feature flag helper
2. `src/components/AppHeader.js` - New header component
3. `src/components/LandingPage.js` - New landing page component  
4. `src/styles/newUI.css` - New UI styles
5. `src/public/index.html` - Feature flag integration
6. `ROUTE_MAP.md` - This documentation

## Testing

- **Default**: Visit site normally (old UI)
- **New UI**: Add `?newui=true` to URL or run `toggleNewUI()` in console
- **Toggle**: Use `toggleNewUI()` function in browser console

## Safety Features

- Feature flag is OFF by default
- Old UI completely preserved
- No changes to API routes or business logic
- Easy rollback by removing URL parameter or localStorage value