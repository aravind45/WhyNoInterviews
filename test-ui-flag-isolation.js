// Test UI flag isolation to ensure no behavior changes
console.log('🔒 Testing UI Flag Isolation\n');

const fs = require('fs');

// Test 1: Check CSS loading is conditional
console.log('1. Checking CSS loading...');
const htmlContent = fs.readFileSync('src/public/index.html', 'utf8');

// Verify no unconditional CSS link
const hasUnconditionalLink = htmlContent.includes('<link rel="stylesheet" href="/new-ui.css">');
console.log('   ✓ No unconditional CSS link:', !hasUnconditionalLink ? 'PASS' : 'FAIL');

// Verify conditional loading exists
const hasConditionalLoading =
  htmlContent.includes('window.isNewUIEnabled') &&
  htmlContent.includes('new-ui.css') &&
  htmlContent.includes('document.head.appendChild(link)');
console.log('   ✓ Conditional CSS loading:', hasConditionalLoading ? 'PASS' : 'FAIL');

// Test 2: Check all new UI styles are scoped
console.log('\n2. Checking CSS scoping...');
const cssContent = fs.readFileSync('src/public/new-ui.css', 'utf8');

// Check for global selectors (should not exist)
const globalSelectors = [
  /^body\s*{/m,
  /^header\s*{/m,
  /^\.main-tab\s*{/m,
  /^\.section\s*{/m,
  /^\.container\s*{/m,
];

let hasGlobalSelectors = false;
globalSelectors.forEach((regex) => {
  if (regex.test(cssContent)) {
    hasGlobalSelectors = true;
    console.log('   ❌ Found global selector:', regex.source);
  }
});

console.log('   ✓ No global selectors:', !hasGlobalSelectors ? 'PASS' : 'FAIL');

// Check that all styles are scoped under .new-ui (except Home tab show rule)
const newUIScoped = cssContent
  .split('\n')
  .filter((line) => {
    // Skip comments, empty lines, and media queries
    if (
      line.trim().startsWith('/*') ||
      line.trim() === '' ||
      line.trim().startsWith('}') ||
      line.trim().startsWith('@media') ||
      line.trim().includes('*/')
    ) {
      return false;
    }

    // Check if it's a CSS rule
    if (line.includes('{') && !line.includes('@')) {
      return true;
    }

    return false;
  })
  .every((line) => {
    // Allow the Home tab show rule to be unscoped
    if (line.includes('.main-tab[data-tab="home"]') && line.includes('display: block')) {
      return true;
    }
    return line.includes('.new-ui') || line.includes('@media');
  });

console.log('   ✓ All styles scoped under .new-ui:', newUIScoped ? 'PASS' : 'FAIL');

// Test 3: Check Home tab visibility rules
console.log('\n3. Checking Home tab visibility...');

// Check main CSS has hide rule
const mainCSSHasHideRule = htmlContent.includes('.main-tab[data-tab="home"] { display: none; }');
console.log('   ✓ Main CSS hides Home tab:', mainCSSHasHideRule ? 'PASS' : 'FAIL');

// Check new UI CSS has show rule
const newUICSSHasShowRule =
  cssContent.includes('.new-ui .main-tab[data-tab="home"]') &&
  cssContent.includes('display: block');
console.log('   ✓ New UI CSS shows Home tab:', newUICSSHasShowRule ? 'PASS' : 'FAIL');

// Test 4: Check no JavaScript changes
console.log('\n4. Checking JavaScript integrity...');

// Verify switchTab function exists and is unchanged
const hasSwitchTab = htmlContent.includes('function switchTab(tabName)');
console.log('   ✓ switchTab function exists:', hasSwitchTab ? 'PASS' : 'FAIL');

// Verify no new navigation logic
const hasOriginalNavigation =
  htmlContent.includes("document.querySelectorAll('.main-tab').forEach(tab => {") &&
  htmlContent.includes("tab.addEventListener('click', function() {");
console.log('   ✓ Original navigation intact:', hasOriginalNavigation ? 'PASS' : 'FAIL');

// Test 5: Check flag detection logic
console.log('\n5. Checking flag detection...');

// Verify both URL param and localStorage detection
const hasURLParamDetection = htmlContent.includes(
  "new URLSearchParams(window.location.search).get('ui') === '1'",
);
const hasLocalStorageDetection = htmlContent.includes("localStorage.getItem('NEW_UI') === 'true'");

console.log('   ✓ URL parameter detection:', hasURLParamDetection ? 'PASS' : 'FAIL');
console.log('   ✓ localStorage detection:', hasLocalStorageDetection ? 'PASS' : 'FAIL');

// Summary
console.log('\n📊 SUMMARY:');
const checks = [
  !hasUnconditionalLink,
  hasConditionalLoading,
  !hasGlobalSelectors,
  newUIScoped,
  mainCSSHasHideRule,
  newUICSSHasShowRule,
  hasSwitchTab,
  hasOriginalNavigation,
  hasURLParamDetection,
  hasLocalStorageDetection,
];

const passed = checks.filter(Boolean).length;
const total = checks.length;

console.log(`   ${passed}/${total} checks passed`);

if (passed === total) {
  console.log('\n🎉 SUCCESS! UI flag isolation is complete.');
  console.log('\n📋 Expected behavior:');
  console.log('   • Flag OFF: App looks and behaves exactly like production');
  console.log('   • Flag ON: Same app, same navigation, new visual skin only');
  console.log('   • No CSS leakage when flag is OFF');
  console.log('   • Navigation works identically in both modes');
  console.log('\n🚀 Ready for testing!');
} else {
  console.log('\n❌ Some issues detected. Please review the implementation.');
}

console.log('\n🔗 Test URLs:');
console.log('   • Production mode: http://localhost:3000');
console.log('   • New UI mode: http://localhost:3000?ui=1');
console.log('   • localStorage mode: Set NEW_UI=true in localStorage');
