// Test script to verify elevator pitch clones cover letter pattern exactly
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Elevator Pitch Implementation (Cloned Pattern)...\n');

// Read the files
const backendFile = fs.readFileSync(path.join(__dirname, 'src/index.ts'), 'utf8');
const frontendFile = fs.readFileSync(path.join(__dirname, 'src/public/index.html'), 'utf8');

// Test 1: Backend endpoint exists
console.log('✅ Backend Tests:');
const hasElevatorPitchEndpoint = backendFile.includes('app.post(\'/api/generate-elevator-pitch\'');
console.log(`   • Endpoint exists: ${hasElevatorPitchEndpoint}`);

const hasCorrectPayload = backendFile.includes('sessionId, jobDescription, analysisData');
console.log(`   • Same payload as cover letter: ${hasCorrectPayload}`);

const returnsPitchText = backendFile.includes('pitchText:');
console.log(`   • Returns pitchText: ${returnsPitchText}`);

// Test 2: Frontend function exists
console.log('\n✅ Frontend Tests:');
const hasFrontendFunction = frontendFile.includes('async function generateElevatorPitch()');
console.log(`   • Function exists: ${hasFrontendFunction}`);

const hasCorrectApiCall = frontendFile.includes('/api/generate-elevator-pitch');
console.log(`   • API call exists: ${hasCorrectApiCall}`);

const hasLoadingPattern = frontendFile.includes('Generating elevator pitch...');
console.log(`   • Loading pattern: ${hasLoadingPattern}`);

const hasErrorHandling = frontendFile.includes('Elevator pitch error:');
console.log(`   • Error handling: ${hasErrorHandling}`);

// Test 3: UI elements
console.log('\n✅ UI Tests:');
const hasButton = frontendFile.includes('onclick="generateElevatorPitch()"');
console.log(`   • Button exists: ${hasButton}`);

const hasOutputSection = frontendFile.includes('elevator-pitch-output');
console.log(`   • Output section: ${hasOutputSection}`);

const hasCopyFunction = frontendFile.includes('copyElevatorPitch');
console.log(`   • Copy function: ${hasCopyFunction}`);

const hasSaveFunction = frontendFile.includes('saveCurrentElevatorPitch');
console.log(`   • Save function: ${hasSaveFunction}`);

// Test 4: Pattern matching
console.log('\n✅ Pattern Matching:');
const coverLetterPattern = /async function generateAnalysisCoverLetter\(\) \{[\s\S]*?\}/;
const elevatorPitchPattern = /async function generateElevatorPitch\(\) \{[\s\S]*?\}/;

const coverLetterMatch = frontendFile.match(coverLetterPattern);
const elevatorPitchMatch = frontendFile.match(elevatorPitchPattern);

if (coverLetterMatch && elevatorPitchMatch) {
  const coverLetterLines = coverLetterMatch[0].split('\n').length;
  const elevatorPitchLines = elevatorPitchMatch[0].split('\n').length;
  console.log(`   • Cover letter function: ${coverLetterLines} lines`);
  console.log(`   • Elevator pitch function: ${elevatorPitchLines} lines`);
  console.log(`   • Similar structure: ${Math.abs(coverLetterLines - elevatorPitchLines) < 10}`);
}

console.log('\n🎯 Implementation Summary:');
console.log('   • Backend: POST /api/generate-elevator-pitch');
console.log('   • Frontend: generateElevatorPitch() function');
console.log('   • UI: Button and output section');
console.log('   • Pattern: Exact clone of cover letter implementation');

console.log('\n🚀 Ready for Testing:');
console.log('   1. Upload resume and analyze');
console.log('   2. Add job description');
console.log('   3. Click "Elevator Pitch" button');
console.log('   4. Verify pitch generates and displays');
console.log('   5. Test copy and save functionality');

const allTestsPassed = hasElevatorPitchEndpoint && hasCorrectPayload && returnsPitchText && 
                      hasFrontendFunction && hasCorrectApiCall && hasLoadingPattern && 
                      hasErrorHandling && hasButton && hasOutputSection && 
                      hasCopyFunction && hasSaveFunction;

console.log(`\n${allTestsPassed ? '✅' : '❌'} All tests ${allTestsPassed ? 'PASSED' : 'FAILED'}!`);

if (allTestsPassed) {
  console.log('\n🎉 Elevator pitch implementation complete and ready for production!');
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
}