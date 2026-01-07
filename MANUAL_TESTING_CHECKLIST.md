# Manual Testing Checklist for ?ui=1 Mode

## Prerequisites

1. ✅ Server running on `http://localhost:3000`
2. ✅ Branch `ui-redesign` checked out
3. ✅ All changes pushed and up to date

## Test 1: New UI Initialization

**URL**: `http://localhost:3000?ui=1`

### Expected Visual Changes:

- [ ] Page background has light gradient (cream/yellow tones)
- [ ] Header is white instead of dark
- [ ] Logo has orange gradient instead of purple
- [ ] Navigation tabs have rounded, pill-like appearance
- [ ] Home tab is visible in navigation

### Browser Console Check:

- [ ] No JavaScript errors in console
- [ ] Body element has `new-ui` class
- [ ] `new-ui.css` file loaded in Network tab

## Test 2: Home Tab Functionality

**Starting from**: `http://localhost:3000?ui=1`

### Home Tab Tests:

- [ ] Home tab is visible in navigation
- [ ] Home tab is active by default (highlighted)
- [ ] Home section content is displayed
- [ ] Home section shows hero content with "Land Your Dream Job" title
- [ ] "Analyze Your Resume Now" button is visible
- [ ] Feature cards are displayed (Match Score, Cover Letter, etc.)

## Test 3: Navigation Tab Clicks

**Test each tab by clicking**:

### Resume Analysis Tab:

- [ ] Click "Resume Analysis" tab
- [ ] Tab becomes active (highlighted)
- [ ] Resume analysis section appears
- [ ] File upload area visible
- [ ] Job description textarea visible
- [ ] "Analyze My Match" button visible

### Job Matching Tab:

- [ ] Click "Job Matching" tab
- [ ] Tab becomes active
- [ ] Job matching section appears
- [ ] Resume upload area visible
- [ ] "Extract My Profile & Find Jobs" button visible

### Resume Optimizer Tab:

- [ ] Click "Resume Optimizer" tab
- [ ] Tab becomes active
- [ ] Optimizer section appears
- [ ] Resume upload and job description areas visible
- [ ] "Optimize My Resume" button visible

### Target Companies Tab:

- [ ] Click "Target Companies" tab
- [ ] Tab becomes active
- [ ] Target companies section appears
- [ ] "Add Company" and "Browse Suggestions" buttons visible

### Networking Tab:

- [ ] Click "Networking" tab
- [ ] Tab becomes active
- [ ] Networking section appears
- [ ] LinkedIn CSV upload area visible

### Return to Home:

- [ ] Click "Home" tab
- [ ] Tab becomes active
- [ ] Home section reappears
- [ ] All home content still visible

## Test 4: Authentication Modals

**Test login/signup functionality**:

### Login Modal:

- [ ] Click "Log In" button in header
- [ ] Login modal opens
- [ ] Modal has white background with proper styling
- [ ] Email and password fields visible
- [ ] "Continue with Google" button visible
- [ ] Close modal with X button works
- [ ] Modal closes properly

### Signup Modal:

- [ ] Click "Sign Up" button in header
- [ ] Signup modal opens
- [ ] Modal has proper styling
- [ ] Name, email, password fields visible
- [ ] "Sign up with Google" button visible
- [ ] Close modal works
- [ ] Modal closes properly

### Modal Switching:

- [ ] Open login modal
- [ ] Click "Sign up" link at bottom
- [ ] Modal switches to signup form
- [ ] Click "Log in" link at bottom
- [ ] Modal switches back to login form

## Test 5: Responsive Design

**Test different screen sizes**:

### Desktop (1200px+):

- [ ] All tabs visible in single row
- [ ] Home hero section has 2-column layout
- [ ] Feature cards in 4-column grid

### Tablet (768px-1024px):

- [ ] Navigation may wrap to multiple lines
- [ ] Home hero becomes single column
- [ ] Feature cards in 2-column grid

### Mobile (< 768px):

- [ ] Navigation stacks vertically or wraps
- [ ] All content stacks in single column
- [ ] Feature cards in single column
- [ ] Touch targets are adequate size

## Test 6: Functionality Integration

**Test that existing features still work**:

### Resume Analysis:

- [ ] Upload a resume file
- [ ] Paste job description
- [ ] Select LLM provider
- [ ] Click "Analyze My Match"
- [ ] Analysis results appear correctly
- [ ] Cover letter generation works
- [ ] Elevator pitch generation works

### Basic Navigation:

- [ ] All sections load without errors
- [ ] Content is properly displayed
- [ ] No broken layouts or overlapping elements

## Test 7: Comparison with Normal Mode

**URL**: `http://localhost:3000` (without ?ui=1)

### Normal Mode Verification:

- [ ] Dark theme (dark background, dark header)
- [ ] Purple logo gradient
- [ ] Home tab is hidden
- [ ] Resume Analysis tab is active by default
- [ ] All existing functionality works unchanged
- [ ] No visual changes from production

### Switch Between Modes:

- [ ] Normal mode → Add `?ui=1` → New UI appears
- [ ] New UI mode → Remove `?ui=1` → Returns to normal mode
- [ ] No JavaScript errors when switching
- [ ] Navigation state resets appropriately

## Test 8: Browser Compatibility

**Test in multiple browsers**:

### Chrome:

- [ ] All functionality works
- [ ] Gradients render correctly
- [ ] No console errors

### Firefox:

- [ ] All functionality works
- [ ] CSS compatibility good
- [ ] No console errors

### Safari (if available):

- [ ] All functionality works
- [ ] Webkit prefixes work
- [ ] No console errors

### Edge:

- [ ] All functionality works
- [ ] No compatibility issues
- [ ] No console errors

## Test 9: Performance Check

**Monitor performance**:

### Network Tab:

- [ ] `new-ui.css` only loads with `?ui=1`
- [ ] No extra network requests
- [ ] CSS file size reasonable

### Console Performance:

- [ ] No memory leaks
- [ ] No excessive DOM queries
- [ ] Event listeners attached properly

## Test 10: Edge Cases

**Test unusual scenarios**:

### URL Manipulation:

- [ ] `?ui=1&other=param` works
- [ ] `?other=param&ui=1` works
- [ ] `?ui=0` shows normal mode
- [ ] `?ui=true` shows normal mode (only `ui=1` works)

### localStorage Test:

- [ ] Set `localStorage.setItem('NEW_UI', 'true')` in console
- [ ] Refresh page without `?ui=1`
- [ ] New UI mode should activate
- [ ] Remove localStorage item
- [ ] Refresh page → Returns to normal mode

## Troubleshooting

**If navigation clicks don't work**:

### Console Test:

```javascript
document.querySelector('.main-tab').click();
```

- [ ] If this works but mouse clicks don't → CSS pointer-events issue
- [ ] If this doesn't work → JavaScript issue

### CSS Fix (if needed):

Add to `new-ui.css`:

```css
.new-ui header {
  pointer-events: auto;
}
.new-ui .header-content {
  pointer-events: auto;
}
.new-ui .main-tabs {
  pointer-events: auto;
}
.new-ui .main-tab {
  pointer-events: auto;
}
```

## Final Verification

- [ ] All tests passed
- [ ] No console errors
- [ ] Both UI modes work correctly
- [ ] Navigation is smooth and responsive
- [ ] Authentication modals function properly
- [ ] Visual design matches expectations

## Sign-off

**Tester**: **\*\***\_\_\_\_**\*\***  
**Date**: **\*\***\_\_\_\_**\*\***  
**Browser(s)**: **\*\***\_\_\_\_**\*\***  
**Status**: ✅ PASS / ❌ FAIL  
**Notes**: **\*\***\_\_\_\_**\*\***
