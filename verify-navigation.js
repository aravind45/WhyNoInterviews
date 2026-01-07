// Simple verification script for navigation fix
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying navigation fix...\n');

// Check HTML file for correct structure
const htmlPath = path.join(__dirname, 'src/public/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Verify Home tab exists without inline style
const homeTabRegex = /<div class="main-tab" data-tab="home">Home<\/div>/;
const hasCorrectHomeTab = homeTabRegex.test(htmlContent);

console.log('✓ Home tab structure correct:', hasCorrectHomeTab);

// Verify other tabs have correct data-tab attributes
const requiredTabs = ['analyze', 'search', 'optimizer', 'target-companies', 'networking'];
const tabsCorrect = requiredTabs.every((tab) => {
  const regex = new RegExp(`data-tab="${tab}"`);
  return regex.test(htmlContent);
});

console.log('✓ All required tabs present:', tabsCorrect);

// Verify switchTab function exists
const hasSwitchTabFunction = htmlContent.includes('function switchTab(tabName)');
console.log('✓ switchTab function exists:', hasSwitchTabFunction);

// Verify DOMContentLoaded handler
const hasInitHandler = htmlContent.includes("document.addEventListener('DOMContentLoaded'");
console.log('✓ DOMContentLoaded handler exists:', hasInitHandler);

// Verify new UI initialization
const hasNewUIInit = htmlContent.includes("switchTab('home')");
console.log('✓ New UI initialization exists:', hasNewUIInit);

// Check CSS file for Home tab visibility rules
const cssPath = path.join(__dirname, 'src/public/new-ui.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// Verify Home tab is hidden by default
const hasHideRule =
  cssContent.includes('main-tab[data-tab="home"]') && cssContent.includes('display: none');
console.log('✓ Home tab hidden by default:', hasHideRule);

// Verify Home tab is shown in new UI
const hasShowRule =
  cssContent.includes('new-ui .main-tab[data-tab="home"]') && cssContent.includes('display: block');
console.log('✓ Home tab shown in new UI:', hasShowRule);

// Verify Home section exists
const hasHomeSection = htmlContent.includes('<section class="section" id="tab-home">');
console.log('✓ Home section exists:', hasHomeSection);

console.log('\n📋 Summary:');
const allChecks = [
  hasCorrectHomeTab,
  tabsCorrect,
  hasSwitchTabFunction,
  hasInitHandler,
  hasNewUIInit,
  hasHideRule,
  hasShowRule,
  hasHomeSection,
];

const passedChecks = allChecks.filter(Boolean).length;
const totalChecks = allChecks.length;

console.log(`${passedChecks}/${totalChecks} checks passed`);

if (passedChecks === totalChecks) {
  console.log('🎉 All navigation fixes are in place!');
  console.log('\nExpected behavior:');
  console.log('- Without ?ui=1: Home tab hidden, existing behavior unchanged');
  console.log('- With ?ui=1: Home tab visible, navigates to Home by default');
  console.log('- All tabs use existing switchTab() function');
  console.log('- No console errors expected');
} else {
  console.log('❌ Some checks failed. Please review the implementation.');
}

console.log('\n🚀 Ready to test in browser!');
