// Debug login issue - run this in browser console
console.log('🔍 Debugging Login Issue\n');

// Test 1: Check if modal functions exist
console.log('1. Checking modal functions...');
console.log('   showAuthModal exists:', typeof showAuthModal === 'function');
console.log('   hideAuthModal exists:', typeof hideAuthModal === 'function');
console.log('   handleLogin exists:', typeof handleLogin === 'function');
console.log('   handleSignup exists:', typeof handleSignup === 'function');

// Test 2: Check if modal elements exist
console.log('\n2. Checking modal elements...');
const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
console.log('   auth-modal exists:', !!authModal);
console.log('   login-form exists:', !!loginForm);
console.log('   signup-form exists:', !!signupForm);

// Test 3: Check if form inputs exist
console.log('\n3. Checking form inputs...');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const signupName = document.getElementById('signup-name');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');

console.log('   login-email exists:', !!loginEmail);
console.log('   login-password exists:', !!loginPassword);
console.log('   signup-name exists:', !!signupName);
console.log('   signup-email exists:', !!signupEmail);
console.log('   signup-password exists:', !!signupPassword);

// Test 4: Check localStorage
console.log('\n4. Checking localStorage...');
const users = JSON.parse(localStorage.getItem('jobmatch_users') || '{}');
const currentUser = JSON.parse(localStorage.getItem('jobmatch_user') || 'null');
console.log('   Stored users:', Object.keys(users));
console.log('   Current user:', currentUser?.email || 'None');

// Test 5: Try to open login modal
console.log('\n5. Testing modal opening...');
try {
  if (typeof showAuthModal === 'function') {
    showAuthModal('login');
    console.log('   ✅ Login modal opened successfully');
  } else {
    console.log('   ❌ showAuthModal function not found');
  }
} catch (error) {
  console.log('   ❌ Error opening modal:', error.message);
}

// Test 6: Create a test user for login testing
console.log('\n6. Creating test user...');
try {
  const testUsers = JSON.parse(localStorage.getItem('jobmatch_users') || '{}');
  testUsers['test@example.com'] = {
    name: 'Test User',
    email: 'test@example.com',
    password: btoa('password123'),
    createdAt: Date.now(),
    savedResumes: [],
    savedCoverLetters: [],
    savedProfile: null
  };
  localStorage.setItem('jobmatch_users', JSON.stringify(testUsers));
  console.log('   ✅ Test user created: test@example.com / password123');
} catch (error) {
  console.log('   ❌ Error creating test user:', error.message);
}

// Test 7: Test login function directly
console.log('\n7. Testing login function...');
if (loginEmail && loginPassword && typeof handleLogin === 'function') {
  loginEmail.value = 'test@example.com';
  loginPassword.value = 'password123';
  
  try {
    const fakeEvent = { preventDefault: () => {} };
    handleLogin(fakeEvent);
    console.log('   ✅ Login function executed');
  } catch (error) {
    console.log('   ❌ Login function error:', error.message);
  }
} else {
  console.log('   ❌ Cannot test login - missing elements or function');
}

console.log('\n📋 INSTRUCTIONS:');
console.log('1. Run this script in browser console on http://localhost:3000?ui=1');
console.log('2. Check for any ❌ errors above');
console.log('3. Try logging in with: test@example.com / password123');
console.log('4. If modal doesn\'t open, check for JavaScript errors in console');

console.log('\n🔧 QUICK FIXES:');
console.log('• If modal doesn\'t open: Check for CSS pointer-events blocking clicks');
console.log('• If form doesn\'t submit: Check for JavaScript errors');
console.log('• If login fails: Use the test user created above');
console.log('• If nothing works: Check browser console for errors');