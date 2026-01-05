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

        // Display scores
        document.getElementById('overall-score').textContent = feedback.overallScore || '--';
        document.getElementById('communication-score').textContent = feedback.categoryScores?.communication || '--';
        document.getElementById('technical-score').textContent = feedback.categoryScores?.technical || '--';
        document.getElementById('confidence-score').textContent = feedback.categoryScores?.confidence || '--';

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

        // Display improvements
        const improvementsList = document.getElementById('improvements-list');
        improvementsList.innerHTML = '';
        if (feedback.improvements && feedback.improvements.length > 0) {
            feedback.improvements.forEach(improvement => {
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
    } catch (error) {
        console.error('Error fetching results:', error);
        alert('Failed to load results. Please try again.');
    }
}
