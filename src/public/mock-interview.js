// Mock Interview Client-Side Logic
let currentSession = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let timerInterval = null;
let recordingStartTime = null;

// Initialize camera on page load
async function initializeCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: true
        });
        const videoElement = document.getElementById('preview-video');
        if (videoElement) {
            videoElement.srcObject = stream;
        }
        return true;
    } catch (error) {
        console.error('Camera initialization failed:', error);
        alert('Unable to access camera/microphone. Please grant permissions.');
        return false;
    }
}

// Start Interview
async function startInterview() {
    const jobRole = document.getElementById('job-role').value;
    const interviewType = document.getElementById('interview-type').value;
    const duration = parseInt(document.getElementById('duration').value);

    if (!jobRole) {
        alert('Please enter a job role');
        return;
    }

    try {
        // Generate questions
        const questionsResponse = await fetch('/api/mock-interview/generate-interview-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobRole,
                interviewType,
                experienceLevel: 'mid',
                duration
            })
        });

        if (!questionsResponse.ok) throw new Error('Failed to generate questions');
        const questionsData = await questionsResponse.json();
        currentQuestions = questionsData.data;

        // Create session
        const sessionResponse = await fetch('/api/mock-interview/interview-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobRole, interviewType, duration })
        });

        if (!sessionResponse.ok) throw new Error('Failed to create session');
        const sessionData = await sessionResponse.json();
        currentSession = sessionData.data;

        // Initialize camera
        const cameraReady = await initializeCamera();
        if (!cameraReady) return;

        // Show session screen
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('session-screen').classList.remove('hidden');

        // Load first question
        loadQuestion(0);
    } catch (error) {
        console.error('Error starting interview:', error);
        alert('Failed to start interview. Please try again.');
    }
}

// Load Question
function loadQuestion(index) {
    if (index >= currentQuestions.length) {
        finishInterview();
        return;
    }

    currentQuestionIndex = index;
    const question = currentQuestions[index];

    document.getElementById('question-number').textContent = `Question ${index + 1} of ${currentQuestions.length}`;
    document.getElementById('question-text').textContent = question.text;
    document.getElementById('timer').textContent = '00:00';

    // Reset buttons
    document.getElementById('start-recording-btn').classList.remove('hidden');
    document.getElementById('stop-recording-btn').classList.add('hidden');
    document.getElementById('next-question-btn').classList.add('hidden');
}

// Start Recording
function startRecording() {
    recordedChunks = [];
    recordingStartTime = Date.now();

    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
    });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        uploadRecording();
    };

    mediaRecorder.start();

    // Update UI
    document.getElementById('start-recording-btn').classList.add('hidden');
    document.getElementById('stop-recording-btn').classList.remove('hidden');

    // Start timer
    timerInterval = setInterval(updateTimer, 1000);
}

// Update Timer
function updateTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('timer').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Stop Recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Update UI
    document.getElementById('stop-recording-btn').classList.add('hidden');
    document.getElementById('next-question-btn').classList.remove('hidden');
}

// Upload Recording
async function uploadRecording() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const formData = new FormData();
    formData.append('video', blob, `response_${Date.now()}.webm`);
    formData.append('sessionToken', currentSession.sessionToken);
    formData.append('questionId', currentQuestions[currentQuestionIndex].id);

    try {
        // In a real implementation, upload to server storage first
        // For MVP, we'll use a placeholder URL
        const videoUrl = `/uploads/mock-interview/${currentSession.sessionToken}_q${currentQuestionIndex}.webm`;

        const response = await fetch('/api/mock-interview/upload-interview-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken: currentSession.sessionToken,
                questionId: currentQuestions[currentQuestionIndex].id,
                videoUrl
            })
        });

        if (!response.ok) throw new Error('Upload failed');
        console.log('Recording uploaded successfully');
    } catch (error) {
        console.error('Error uploading recording:', error);
        alert('Failed to upload recording. Please try again.');
    }
}

// Next Question
function nextQuestion() {
    loadQuestion(currentQuestionIndex + 1);
}

// Finish Interview
async function finishInterview() {
    // Stop camera
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    // Show loading state
    document.getElementById('session-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.remove('hidden');

    try {
        // Fetch results
        const response = await fetch(`/api/mock-interview/interview-results/${currentSession.sessionToken}`);
        if (!response.ok) throw new Error('Failed to fetch results');

        const data = await response.json();
        const feedback = data.data;

        // Display overall score
        document.getElementById('overall-score').textContent = feedback.overallScore ? `${feedback.overallScore}%` : '--';

        // Display rubric scores
        displayRubricScores(feedback.rubrics || {});

        // Display strengths
        const strengthsList = document.getElementById('strengths-list');
        strengthsList.innerHTML = '';
        if (feedback.strengths && feedback.strengths.length > 0) {
            feedback.strengths.forEach(strength => {
                const li = document.createElement('li');
                li.textContent = strength;
                strengthsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'empty-state';
            li.textContent = 'No specific strengths identified. Keep practicing to improve your performance!';
            strengthsList.appendChild(li);
        }

        // Display growth areas (improvements)
        const improvementsList = document.getElementById('improvements-list');
        improvementsList.innerHTML = '';
        const growthAreas = feedback.growthAreas || feedback.improvements || [];
        if (growthAreas.length > 0) {
            growthAreas.forEach(improvement => {
                const li = document.createElement('li');
                li.textContent = improvement;
                improvementsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'empty-state';
            li.textContent = 'Great job! No major areas for improvement identified.';
            improvementsList.appendChild(li);
        }

        // Display detailed feedback
        if (feedback.detailedFeedback && feedback.detailedFeedback.length > 0) {
            displayDetailedFeedback(feedback.detailedFeedback);
        }

        // Display summary
        if (feedback.summary && feedback.summary.length > 0) {
            displaySummary(feedback.summary);
        }

        // Display next steps
        if (feedback.nextSteps && feedback.nextSteps.length > 0) {
            displayNextSteps(feedback.nextSteps);
        }
    } catch (error) {
        console.error('Error fetching results:', error);
        alert('Failed to load results. Please try again.');
    }
}

function displayRubricScores(rubrics) {
    const container = document.getElementById('rubric-scores');
    container.innerHTML = '';
    
    const rubricNames = {
        activeListening: 'Active Listening',
        keyAccomplishments: 'Key Accomplishments',
        relevantQuestions: 'Relevant Questions',
        communication: 'Communication',
        technicalKnowledge: 'Technical Knowledge',
        problemSolving: 'Problem Solving'
    };
    
    Object.entries(rubrics).forEach(([key, rubric]) => {
        const rubricDiv = document.createElement('div');
        rubricDiv.className = 'rubric-item';
        
        const stars = Array.from({length: 5}, (_, i) => 
            `<span class="star ${i < rubric.score ? 'filled' : ''}">★</span>`
        ).join('');
        
        rubricDiv.innerHTML = `
            <div class="rubric-header">
                <div class="rubric-title">${rubricNames[key] || key}</div>
                <div class="rubric-score">
                    <span class="score-display">${rubric.score}/${rubric.maxScore}</span>
                    <div class="score-stars">${stars}</div>
                </div>
            </div>
            <div class="rubric-feedback">${rubric.feedback}</div>
            <div class="rubric-improvements">${rubric.improvements}</div>
        `;
        
        container.appendChild(rubricDiv);
    });
}

function displayDetailedFeedback(detailedFeedback) {
    const container = document.getElementById('detailed-feedback-section');
    container.innerHTML = '<h3 style="margin-bottom: 16px; color: #1e293b;">📝 Detailed Feedback</h3>';
    
    detailedFeedback.forEach(item => {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'detailed-feedback-item';
        
        const toneHtml = item.tone ? `
            <div class="tone-indicators">
                <div class="tone-item">
                    <div class="tone-label">Professional</div>
                    <div class="tone-score">${item.tone.professional}%</div>
                </div>
                <div class="tone-item">
                    <div class="tone-label">Clear</div>
                    <div class="tone-score">${item.tone.clear}%</div>
                </div>
                <div class="tone-item">
                    <div class="tone-label">Relaxed</div>
                    <div class="tone-score">${item.tone.relaxed}%</div>
                </div>
                <div class="tone-item">
                    <div class="tone-label">Confident</div>
                    <div class="tone-score">${item.tone.confident}%</div>
                </div>
            </div>
        ` : '';
        
        feedbackDiv.innerHTML = `
            <div class="question-header">Question ${item.questionNumber}: ${item.questionText}</div>
            <div style="color: #374151; margin: 12px 0;">${item.feedback}</div>
            ${toneHtml}
            ${item.conciseness ? `
                <div style="margin-top: 16px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 3px solid #0ea5e9;">
                    <strong>Conciseness Tip (${item.conciseness.timestamp}):</strong>
                    <div style="margin: 8px 0; font-style: italic;">"${item.conciseness.originalText}"</div>
                    <div style="margin: 8px 0; color: #059669;"><strong>Improved:</strong> "${item.conciseness.improvedText}"</div>
                    <div style="font-size: 0.9rem; color: #6b7280;">${item.conciseness.explanation}</div>
                </div>
            ` : ''}
        `;
        
        container.appendChild(feedbackDiv);
    });
}

function displaySummary(summary) {
    const section = document.getElementById('summary-section');
    const list = document.getElementById('summary-list');
    
    list.innerHTML = '';
    summary.forEach(point => {
        const li = document.createElement('li');
        li.textContent = point;
        list.appendChild(li);
    });
    
    section.style.display = 'block';
}

function displayNextSteps(nextSteps) {
    const section = document.getElementById('next-steps-section');
    const list = document.getElementById('next-steps-list');
    
    list.innerHTML = '';
    nextSteps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        list.appendChild(li);
    });
    
    section.style.display = 'block';
}
