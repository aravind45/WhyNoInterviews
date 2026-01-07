// Test Mock Interview Frontend Integration

async function testMockInterviewFrontend() {
  console.log('🎯 Testing Mock Interview Frontend...\n');

  let browser;
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage();

    // Navigate to the app
    await page.goto('http://localhost:3000');

    // Wait for the page to load
    await page.waitForSelector('.main-tab');

    // Check if Mock Interview tab exists
    const mockInterviewTab = await page.$('[data-tab="mock-interview"]');
    if (mockInterviewTab) {
      console.log('✅ Mock Interview tab found');

      // Click on Mock Interview tab
      await mockInterviewTab.click();

      // Wait for the mock interview content to load
      await page.waitForSelector('#tab-mock-interview', { visible: true });

      // Check if the setup form is visible
      const setupForm = await page.$('#mock-interview-setup');
      if (setupForm) {
        console.log('✅ Mock Interview setup form is visible');

        // Fill in the form
        await page.type('#mock-job-role', 'Software Engineer');
        await page.select('#mock-interview-type', 'technical');
        await page.select('#mock-duration', '30');

        console.log('✅ Form filled successfully');
        console.log('   Job Role: Software Engineer');
        console.log('   Interview Type: Technical');
        console.log('   Duration: 30 minutes');

        // Note: We won't actually start the interview as it requires camera permissions
        console.log(
          'ℹ️  Interview start button is ready (camera permissions required for actual test)',
        );
      } else {
        console.log('❌ Mock Interview setup form not found');
      }
    } else {
      console.log('❌ Mock Interview tab not found');
    }

    console.log('\n🎯 Frontend test completed!');
  } catch (error) {
    console.error('❌ Frontend test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if puppeteer is available
try {
  require.resolve('puppeteer');
  testMockInterviewFrontend();
} catch (error) {
  console.log('ℹ️  Puppeteer not available, skipping automated frontend test');
  console.log('   To test frontend manually:');
  console.log('   1. Open http://localhost:3000');
  console.log('   2. Click on "🎯 Mock Interview" tab');
  console.log('   3. Fill in job role, interview type, and duration');
  console.log('   4. Click "🎯 Start Mock Interview"');
  console.log('   5. Grant camera/microphone permissions when prompted');
  console.log('   6. Record responses to interview questions');
  console.log('   7. View AI-generated feedback and scores');
}
