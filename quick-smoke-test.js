// Quick smoke test for new UI functionality
const fs = require('fs');

console.log('🚀 Quick Smoke Test for New UI Mode\n');

function runSmokeTest() {
  const results = {
    passed: 0,
    total: 0,
    issues: []
  };

  function test(description, condition, fix = null) {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${description}`);
    } else {
      console.log(`❌ ${description}`);
      if (fix) results.issues.push({ description, fix });
    }
  }

  // Read files
  const htmlContent = fs.readFileSync('src/public/index.html', 'utf8');
  const cssContent = fs.readFileSync('src/public/new-ui.css', 'utf8');

  console.log('Testing core functionality...\n');

  // Test 1: CSS Loading
  test(
    'CSS loads conditionally',
    htmlContent.includes('window.isNewUIEnabled') && 
    htmlContent.includes('new-ui.css') &&
    !htmlContent.includes('<link rel="stylesheet" href="/new-ui.css">')
  );

  // Test 2: Home Tab
  test(
    'Home tab exists and is properly controlled',
    htmlContent.includes('data-tab="home"') &&
    htmlContent.includes('.main-tab[data-tab="home"] { display: none; }') &&
    cssContent.includes('.new-ui .main-tab[data-tab="home"]')
  );

  // Test 3: Navigation
  test(
    'Event delegation for navigation exists',
    htmlContent.includes('document.addEventListener("click", (e) => {') &&
    htmlContent.includes('e.target.closest(".main-tab")') &&
    htmlContent.includes('switchTab(tabName)')
  );

  // Test 4: All required tabs
  const requiredTabs = ['home', 'analyze', 'search', 'optimizer', 'target-companies', 'networking'];
  test(
    'All navigation tabs exist',
    requiredTabs.every(tab => htmlContent.includes(`data-tab="${tab}"`))
  );

  // Test 5: All sections exist
  test(
    'All sections exist',
    requiredTabs.every(tab => htmlContent.includes(`id="tab-${tab}"`))
  );

  // Test 6: switchTab function
  test(
    'switchTab function exists',
    htmlContent.includes('function switchTab(tabName)') &&
    htmlContent.includes('document.querySelectorAll(\'.main-tab\').forEach(tab => {') &&
    htmlContent.includes('tab.classList.remove(\'active\')')
  );

  // Test 7: CSS Scoping
  test(
    'CSS is properly scoped',
    cssContent.includes('.new-ui {') &&
    cssContent.includes('.new-ui header {') &&
    !cssContent.match(/^body\s*{/m) &&
    !cssContent.match(/^header\s*{/m)
  );

  // Test 8: Auth modals
  test(
    'Auth modals exist',
    htmlContent.includes('id="auth-modal"') &&
    htmlContent.includes('showAuthModal') &&
    htmlContent.includes('hideAuthModal')
  );

  // Test 9: Home section content
  test(
    'Home section has content',
    htmlContent.includes('id="tab-home"') &&
    htmlContent.includes('Land Your Dream Job') &&
    htmlContent.includes('home-cta-primary')
  );

  // Test 10: New UI initialization
  test(
    'New UI initialization exists',
    htmlContent.includes('if (isNewUI) {') &&
    htmlContent.includes('document.body.classList.add(\'new-ui\')') &&
    htmlContent.includes('switchTab(\'home\')')
  );

  // Results
  console.log(`\n📊 SMOKE TEST RESULTS:`);
  console.log(`   ${results.passed}/${results.total} tests passed`);
  
  if (results.passed === results.total) {
    console.log('\n🎉 ALL TESTS PASSED! Core functionality is ready.');
    console.log('\n🔗 Quick Manual Verification:');
    console.log('   1. Start server: npm start');
    console.log('   2. Open: http://localhost:3000?ui=1');
    console.log('   3. Check: Light theme, Home tab visible, navigation works');
    console.log('   4. Test: Click each tab, open login/signup modals');
    console.log('\n✅ If the above works, everything is functioning correctly!');
    return true;
  } else {
    console.log('\n❌ Some tests failed. Issues found:');
    results.issues.forEach(issue => {
      console.log(`   - ${issue.description}`);
      if (issue.fix) console.log(`     Fix: ${issue.fix}`);
    });
    return false;
  }
}

// Run the test
const success = runSmokeTest();
process.exit(success ? 0 : 1);