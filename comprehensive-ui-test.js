// Comprehensive test for ?ui=1 functionality
const puppeteer = require('puppeteer');

async function testNewUIMode() {
  console.log('🧪 Comprehensive New UI Mode Test\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1200, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    console.log('1. Loading application with ?ui=1 flag...');
    await page.goto('http://localhost:3000?ui=1', { waitUntil: 'networkidle0' });

    // Test 1: Check new UI is enabled
    console.log('\n2. Checking new UI initialization...');

    const hasNewUIClass = await page.evaluate(() => {
      return document.body.classList.contains('new-ui');
    });
    console.log('   ✓ Body has .new-ui class:', hasNewUIClass ? 'YES' : 'NO');

    const newUICSSLoaded = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.some((link) => link.href.includes('new-ui.css'));
    });
    console.log('   ✓ New UI CSS loaded:', newUICSSLoaded ? 'YES' : 'NO');

    // Test 2: Check Home tab visibility and navigation
    console.log('\n3. Testing Home tab and navigation...');

    const homeTabVisible = await page.evaluate(() => {
      const homeTab = document.querySelector('[data-tab="home"]');
      return homeTab && window.getComputedStyle(homeTab).display !== 'none';
    });
    console.log('   ✓ Home tab visible:', homeTabVisible ? 'YES' : 'NO');

    const homeTabActive = await page.evaluate(() => {
      const homeTab = document.querySelector('[data-tab="home"]');
      return homeTab && homeTab.classList.contains('active');
    });
    console.log('   ✓ Home tab active by default:', homeTabActive ? 'YES' : 'NO');

    const homeSection = await page.evaluate(() => {
      const section = document.getElementById('tab-home');
      return section && section.classList.contains('active');
    });
    console.log('   ✓ Home section visible:', homeSection ? 'YES' : 'NO');

    // Test 3: Test all navigation tabs
    console.log('\n4. Testing navigation tab clicks...');

    const tabs = [
      { name: 'analyze', label: 'Resume Analysis' },
      { name: 'search', label: 'Job Matching' },
      { name: 'optimizer', label: 'Resume Optimizer' },
      { name: 'target-companies', label: 'Target Companies' },
      { name: 'networking', label: 'Networking' },
    ];

    for (const tab of tabs) {
      console.log(`   Testing ${tab.label} tab...`);

      // Click the tab
      await page.click(`[data-tab="${tab.name}"]`);
      await page.waitForTimeout(500); // Wait for transition

      // Check if tab becomes active
      const tabActive = await page.evaluate((tabName) => {
        const tabEl = document.querySelector(`[data-tab="${tabName}"]`);
        return tabEl && tabEl.classList.contains('active');
      }, tab.name);

      // Check if section becomes visible
      const sectionActive = await page.evaluate((tabName) => {
        const section = document.getElementById(`tab-${tabName}`);
        return section && section.classList.contains('active');
      }, tab.name);

      console.log(`     ✓ Tab active: ${tabActive ? 'YES' : 'NO'}`);
      console.log(`     ✓ Section visible: ${sectionActive ? 'YES' : 'NO'}`);

      if (!tabActive || !sectionActive) {
        console.log(`     ❌ Navigation failed for ${tab.label}`);
      }
    }

    // Test 4: Test Home tab click
    console.log('\n5. Testing Home tab click...');
    await page.click('[data-tab="home"]');
    await page.waitForTimeout(500);

    const homeActiveAfterClick = await page.evaluate(() => {
      const homeTab = document.querySelector('[data-tab="home"]');
      const homeSection = document.getElementById('tab-home');
      return {
        tabActive: homeTab && homeTab.classList.contains('active'),
        sectionVisible: homeSection && homeSection.classList.contains('active'),
      };
    });

    console.log('   ✓ Home tab active after click:', homeActiveAfterClick.tabActive ? 'YES' : 'NO');
    console.log(
      '   ✓ Home section visible after click:',
      homeActiveAfterClick.sectionVisible ? 'YES' : 'NO',
    );

    // Test 5: Test auth modals
    console.log('\n6. Testing authentication modals...');

    // Test login modal
    await page.click('button:contains("Log In")');
    await page.waitForTimeout(500);

    const loginModalVisible = await page.evaluate(() => {
      const modal = document.getElementById('auth-modal');
      return modal && modal.classList.contains('show');
    });
    console.log('   ✓ Login modal opens:', loginModalVisible ? 'YES' : 'NO');

    // Close login modal
    if (loginModalVisible) {
      await page.click('.modal-close');
      await page.waitForTimeout(500);
    }

    // Test signup modal
    await page.click('button:contains("Sign Up")');
    await page.waitForTimeout(500);

    const signupModalVisible = await page.evaluate(() => {
      const modal = document.getElementById('auth-modal');
      return modal && modal.classList.contains('show');
    });
    console.log('   ✓ Signup modal opens:', signupModalVisible ? 'YES' : 'NO');

    // Close signup modal
    if (signupModalVisible) {
      await page.click('.modal-close');
      await page.waitForTimeout(500);
    }

    // Test 6: Check for console errors
    console.log('\n7. Checking for console errors...');

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Trigger some interactions to catch any errors
    await page.click('[data-tab="analyze"]');
    await page.waitForTimeout(500);
    await page.click('[data-tab="home"]');
    await page.waitForTimeout(500);

    console.log('   ✓ Console errors found:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('   Errors:');
      consoleErrors.forEach((error) => console.log(`     - ${error}`));
    }

    // Test 7: Visual verification
    console.log('\n8. Visual verification...');

    const visualElements = await page.evaluate(() => {
      return {
        hasGradientBackground: window
          .getComputedStyle(document.body)
          .background.includes('gradient'),
        headerIsWhite:
          window.getComputedStyle(document.querySelector('header')).backgroundColor ===
          'rgb(255, 255, 255)',
        logoHasOrangeGradient: window
          .getComputedStyle(document.querySelector('.logo span'))
          .background.includes('gradient'),
        tabsHaveRoundedStyle:
          window.getComputedStyle(document.querySelector('.main-tabs')).borderRadius !== '0px',
      };
    });

    console.log('   ✓ Gradient background:', visualElements.hasGradientBackground ? 'YES' : 'NO');
    console.log('   ✓ White header:', visualElements.headerIsWhite ? 'YES' : 'NO');
    console.log('   ✓ Orange logo gradient:', visualElements.logoHasOrangeGradient ? 'YES' : 'NO');
    console.log('   ✓ Rounded tab style:', visualElements.tabsHaveRoundedStyle ? 'YES' : 'NO');

    console.log('\n📊 TEST SUMMARY:');
    console.log('✅ New UI mode comprehensive test completed');
    console.log('🔗 Tested URL: http://localhost:3000?ui=1');
    console.log('⏱️  Test duration: ~30 seconds');

    // Keep browser open for manual inspection
    console.log('\n🔍 Browser left open for manual inspection...');
    console.log('   Press Ctrl+C to close when done');

    // Wait indefinitely until user closes
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Browser will be closed when user presses Ctrl+C
  }
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Run the test
(async () => {
  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.log('❌ Server not running on http://localhost:3000');
    console.log('   Please start the server first with: npm start');
    process.exit(1);
  }

  await testNewUIMode();
})();
