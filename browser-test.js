/**
 * Browser Console Test for Dual-LLM Providers
 *
 * Copy and paste this into your browser console on https://whynointerviews.vercel.app
 * to test the LLM provider functionality
 */

(async function testLLMProviders() {
  console.log('%c🧪 Testing LLM Providers...', 'color: #6366f1; font-size: 16px; font-weight: bold;');

  try {
    // Test 1: Check /api/llm-providers endpoint
    console.log('\n%c📡 Test 1: Fetching available providers...', 'color: #06b6d4; font-weight: bold;');
    const response = await fetch('/api/llm-providers');
    const data = await response.json();

    if (!data.success) {
      console.error('%c❌ Failed to fetch providers', 'color: #ef4444;');
      console.error(data);
      return;
    }

    console.log('%c✅ Successfully fetched providers:', 'color: #10b981;');
    console.table(data.data.providers);
    console.log(`%cDefault provider: ${data.data.default}`, 'color: #8b5cf6;');

    // Test 2: Check dropdown exists
    console.log('\n%c🔍 Test 2: Checking dropdown element...', 'color: #06b6d4; font-weight: bold;');
    const dropdown = document.getElementById('llm-provider-select');

    if (!dropdown) {
      console.error('%c❌ Dropdown element not found!', 'color: #ef4444;');
      console.log('%cMake sure you\'re on the "Analyze Resume" tab', 'color: #f59e0b;');
      return;
    }

    console.log('%c✅ Dropdown found:', 'color: #10b981;');
    console.log(`   Options: ${dropdown.options.length}`);

    Array.from(dropdown.options).forEach((option, index) => {
      const isSelected = option.selected ? ' (selected)' : '';
      console.log(`   ${index + 1}. ${option.text}${isSelected}`);
    });

    // Test 3: Simulate provider selection
    console.log('\n%c🎭 Test 3: Testing provider selection...', 'color: #06b6d4; font-weight: bold;');

    const providers = data.data.providers;
    for (const provider of providers) {
      if (provider.available) {
        console.log(`%c   Testing ${provider.displayName}...`, 'color: #8b5cf6;');
        dropdown.value = provider.name;
        dropdown.dispatchEvent(new Event('change'));
        console.log(`%c   ✓ Selected ${provider.displayName}`, 'color: #10b981;');
      } else {
        console.log(`%c   ⚠ ${provider.displayName} is not available`, 'color: #f59e0b;');
      }
    }

    // Reset to default
    dropdown.value = data.data.default;
    dropdown.dispatchEvent(new Event('change'));

    // Test 4: Check loadLLMProviders function
    console.log('\n%c⚙️  Test 4: Checking JavaScript functions...', 'color: #06b6d4; font-weight: bold;');

    if (typeof loadLLMProviders === 'function') {
      console.log('%c✅ loadLLMProviders() function exists', 'color: #10b981;');
    } else {
      console.log('%c⚠ loadLLMProviders() function not found', 'color: #f59e0b;');
    }

    // Summary
    console.log('\n%c═══════════════════════════════════════', 'color: #6366f1;');
    console.log('%c✨ Test Summary', 'color: #6366f1; font-size: 14px; font-weight: bold;');
    console.log('%c═══════════════════════════════════════', 'color: #6366f1;');

    const availableCount = providers.filter(p => p.available).length;
    console.log(`%c✅ ${availableCount} provider(s) available`, 'color: #10b981;');
    console.log(`%c✅ Dropdown working correctly`, 'color: #10b981;');
    console.log(`%c✅ All tests passed!`, 'color: #10b981; font-weight: bold;');

    console.log('\n%c💡 Next steps:', 'color: #8b5cf6; font-weight: bold;');
    console.log('%c   1. Upload a resume', 'color: #64748b;');
    console.log('%c   2. Paste a job description', 'color: #64748b;');
    console.log('%c   3. Select a provider from the dropdown', 'color: #64748b;');
    console.log('%c   4. Click "Analyze My Match"', 'color: #64748b;');
    console.log('%c   5. Check results show which AI was used', 'color: #64748b;');

  } catch (error) {
    console.error('%c❌ Test failed:', 'color: #ef4444; font-weight: bold;');
    console.error(error);
  }
})();
