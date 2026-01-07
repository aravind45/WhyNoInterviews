// Test navigation in new UI mode
const puppeteer = require('puppeteer');

async function testNavigation() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Test without new UI flag
    console.log('Testing navigation without ?ui=1 flag...');
    await page.goto('http://localhost:3000');

    // Check that Home tab is hidden
    const homeTabHidden = await page.evaluate(() => {
      const homeTab = document.querySelector('[data-tab="home"]');
      return homeTab && window.getComputedStyle(homeTab).display === 'none';
    });

    console.log('Home tab hidden without flag:', homeTabHidden);

    // Check that other tabs are visible and clickable
    const analyzeTab = await page.$('[data-tab="analyze"]');
    if (analyzeTab) {
      await analyzeTab.click();
      console.log('Analyze tab clicked successfully');
    }

    // Test with new UI flag
    console.log('\nTesting navigation with ?ui=1 flag...');
    await page.goto('http://localhost:3000?ui=1');

    // Wait for DOM to load
    await page.waitForSelector('.main-tab');

    // Check that Home tab is visible
    const homeTabVisible = await page.evaluate(() => {
      const homeTab = document.querySelector('[data-tab="home"]');
      return homeTab && window.getComputedStyle(homeTab).display !== 'none';
    });

    console.log('Home tab visible with flag:', homeTabVisible);

    // Check that body has new-ui class
    const hasNewUIClass = await page.evaluate(() => {
      return document.body.classList.contains('new-ui');
    });

    console.log('Body has new-ui class:', hasNewUIClass);

    // Check that Home tab is active by default
    const homeTabActive = await page.evaluate(() => {
      const homeTab = document.querySelector('[data-tab="home"]');
      return homeTab && homeTab.classList.contains('active');
    });

    console.log('Home tab is active by default:', homeTabActive);

    // Test clicking other tabs
    const tabs = ['analyze', 'search', 'optimizer', 'target-companies', 'networking'];

    for (const tabName of tabs) {
      console.log(`\nTesting ${tabName} tab...`);

      const tab = await page.$(`[data-tab="${tabName}"]`);
      if (tab) {
        await tab.click();

        // Check if tab becomes active
        const isActive = await page.evaluate((name) => {
          const tab = document.querySelector(`[data-tab="${name}"]`);
          return tab && tab.classList.contains('active');
        }, tabName);

        // Check if corresponding section is shown
        const sectionVisible = await page.evaluate((name) => {
          const section = document.getElementById(`tab-${name}`);
          return section && section.classList.contains('active');
        }, tabName);

        console.log(`${tabName} tab active:`, isActive);
        console.log(`${tabName} section visible:`, sectionVisible);
      }
    }

    // Test clicking Home tab
    console.log('\nTesting Home tab click...');
    const homeTab = await page.$('[data-tab="home"]');
    if (homeTab) {
      await homeTab.click();

      const homeActive = await page.evaluate(() => {
        const tab = document.querySelector('[data-tab="home"]');
        const section = document.getElementById('tab-home');
        return {
          tabActive: tab && tab.classList.contains('active'),
          sectionVisible: section && section.classList.contains('active'),
        };
      });

      console.log('Home tab active after click:', homeActive.tabActive);
      console.log('Home section visible after click:', homeActive.sectionVisible);
    }

    console.log('\n✅ Navigation test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testNavigation().catch(console.error);
