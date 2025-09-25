export class RealtimeOpenAIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.pc = null;
    this.dc = null;
    this.isConnected = false;
    this.audioContext = null;
    this.analyser = null;
    this.onLipSyncData = null;
    this.onTranscript = null;
    this.onUserTranscript = null;
    this.onResponseStart = null; // Reset transcript when new response starts
    this.onResponseComplete = null; // Mark response as complete
    this.isAnalyzing = false;
    this.currentLipSyncData = { A: 0, E: 0, I: 0, O: 0, U: 0 };
    
    // Add microphone stream tracking
    this.microphoneStream = null;
    
    // Add user data storage (can be teacher or student)
    this.userData = null;
    this.userType = null; // 'teacher' or 'student'
    
    this.initializeAudio();
  }

  async initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  async connect(userData = null, userType = 'teacher') {
    try {
      
      // Store user data and type
      this.userData = userData;
      this.userType = userType;
      
      // Create RTCPeerConnection
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // Set up audio
      await this.setupAudio();
      
      // Set up data channel
      this.setupDataChannel();
      
      // Create connection
      await this.establishConnection();
      
      this.isConnected = true;
      
    } catch (error) {
      console.error('❌ Failed to connect to OpenAI:', error);
      throw error;
    }
  }

  async setupAudio() {
    try {
      // Get microphone
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const [track] = this.microphoneStream.getAudioTracks();
      
      // Add to peer connection
      this.pc.addTrack(track, this.microphoneStream);
      
      // Handle incoming audio from OpenAI
      this.pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        this.handleOpenAIAudio(remoteStream);
      };
      
    } catch (error) {
      console.error('Failed to setup audio:', error);
      throw error;
    }
  }

  handleOpenAIAudio(stream) {
    
    // Resume audio context if needed
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Create audio element to play the sound
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 1.0;
    
    // CRITICAL FIX: Connect AI's audio stream to analyser for lip sync
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    
    // Start analyzing AI's audio for lip sync
    this.startLipSyncAnalysis();
    
    // Stop analyzing when track ends
    stream.getAudioTracks()[0].addEventListener('ended', () => {
      this.stopLipSyncAnalysis();
    });
  }

  startLipSyncAnalysis() {
    if (this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    
    const analyze = () => {
      if (!this.isAnalyzing) return;
      
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate overall volume
      const volume = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength / 255;
      
      if (volume > 0.01) {
        // Generate lip sync data from frequency analysis
        const lipSyncData = this.generateLipSyncFromAudio(dataArray, volume);
        
        // Smooth the data
        this.currentLipSyncData = this.smoothLipSyncData(this.currentLipSyncData, lipSyncData);
        
        if (this.onLipSyncData) {
          this.onLipSyncData(this.currentLipSyncData);
        }
      } else {
        // Fade to neutral when no audio
        this.currentLipSyncData = this.smoothLipSyncData(this.currentLipSyncData, {
          A: 0, E: 0, I: 0, O: 0, U: 0
        });
        
        if (this.onLipSyncData) {
          this.onLipSyncData(this.currentLipSyncData);
        }
      }
      
      requestAnimationFrame(analyze);
    };
    
    analyze();
  }

  generateLipSyncFromAudio(frequencyData, volume) {
    // Analyze different frequency bands for vowel characteristics
    const lowBass = this.getFrequencyAverage(frequencyData, 0, 10);
    const bass = this.getFrequencyAverage(frequencyData, 10, 25);
    const midLow = this.getFrequencyAverage(frequencyData, 25, 50);
    const midHigh = this.getFrequencyAverage(frequencyData, 50, 100);
    const treble = this.getFrequencyAverage(frequencyData, 100, 150);
    
    // Enhanced volume scaling for visible lip sync
    const volumeBoost = Math.min(2.5, volume * 8);
    
    // More dramatic lip sync values
    const lipSyncData = {
      A: Math.max(0, Math.min(1, (lowBass * 2.0 + bass * 1.8) * volumeBoost)),
      E: Math.max(0, Math.min(1, (bass * 1.2 + midHigh * 2.0) * volumeBoost)),
      I: Math.max(0, Math.min(1, (midLow * 1.0 + treble * 2.2) * volumeBoost)),
      O: Math.max(0, Math.min(1, (lowBass * 1.8 + bass * 1.6) * volumeBoost)),
      U: Math.max(0, Math.min(1, (lowBass * 2.0 + midLow * 1.2) * volumeBoost))
    };
    
    // Add minimum threshold for visible movement
    const minThreshold = 0.15;
    Object.keys(lipSyncData).forEach(key => {
      if (lipSyncData[key] > 0.05) {
        lipSyncData[key] = Math.max(minThreshold, lipSyncData[key]);
      }
    });
    
    return lipSyncData;
  }

  getFrequencyAverage(dataArray, startIndex, endIndex) {
    let sum = 0;
    const actualEnd = Math.min(endIndex, dataArray.length);
    const count = actualEnd - startIndex;
    
    for (let i = startIndex; i < actualEnd; i++) {
      sum += dataArray[i];
    }
    
    return count > 0 ? (sum / count) / 255 : 0;
  }

  smoothLipSyncData(current, target, smoothing = 0.3) {
    return {
      A: current.A + (target.A - current.A) * smoothing,
      E: current.E + (target.E - current.E) * smoothing,
      I: current.I + (target.I - current.I) * smoothing,
      O: current.O + (target.O - current.O) * smoothing,
      U: current.U + (target.U - current.U) * smoothing
    };
  }

  stopLipSyncAnalysis() {
    this.isAnalyzing = false;
    
    // Fade to neutral
    const fadeSteps = 20;
    let step = 0;
    
    const fade = () => {
      step++;
      const progress = step / fadeSteps;
      
      this.currentLipSyncData = {
        A: this.currentLipSyncData.A * (1 - progress),
        E: this.currentLipSyncData.E * (1 - progress),
        I: this.currentLipSyncData.I * (1 - progress),
        O: this.currentLipSyncData.O * (1 - progress),
        U: this.currentLipSyncData.U * (1 - progress)
      };
      
      if (this.onLipSyncData) {
        this.onLipSyncData(this.currentLipSyncData);
      }
      
      if (step < fadeSteps) {
        setTimeout(fade, 50);
      }
    };
    
    fade();
  }

  setupDataChannel() {
    this.dc = this.pc.createDataChannel('oai-events');
    
    this.dc.addEventListener('open', () => {
      this.sendSessionUpdate(this.userData, this.userType);
    });
    
    this.dc.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    });
  }

  async establishConnection() {
    // Create offer
    await this.pc.setLocalDescription();
    
    // Send to OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
      method: 'POST',
      body: this.pc.localDescription.sdp,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/sdp'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Set remote description
    const answerSdp = await response.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
      
      this.pc.addEventListener('connectionstatechange', () => {
        
        if (this.pc.connectionState === 'connected') {
          clearTimeout(timeout);
          resolve();
        } else if (this.pc.connectionState === 'failed') {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        }
      });
    });
  }

  sendSessionUpdate(userData = null, userType = 'teacher') {
    if (this.dc?.readyState === 'open') {
      // Create the comprehensive prompt for the AI based on user type
      const createPrompt = (userData, userType) => {
        if (userType === 'student') {
          return this.createStudentPrompt(userData);
        } else {
          return this.createTeacherPrompt(userData);
        }
      };

      const message = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: createPrompt(userData, userType),
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      };
      
      this.dc.send(JSON.stringify(message));
    }
  }

  createStudentPrompt(studentData) {
    if (!studentData) {
      return 'You are a friendly and encouraging AI study buddy. Your primary goal is to help students learn, feel supported, and complete their assignments.';
    }

    const studentName = studentData.studentName || 'Student';
    const studentGrade = studentData.grade || '8';
    const subjects = Array.isArray(studentData.subjects) ? studentData.subjects.join(', ') : (studentData.subjects || 'General Studies');
    
    // Format pending tasks
    const pendingTasks = studentData.pending_tasks && studentData.pending_tasks.length > 0 
      ? studentData.pending_tasks.map(task => `- ${task.title || task.name || 'Task'}: ${task.description || 'No description available'}`).join('\n')
      : 'No pending tasks at the moment';

    // Format recent activities
    const recentActivities = studentData.recentActivities && studentData.recentActivities.length > 0
      ? studentData.recentActivities.map(activity => `- ${activity.title || activity.name || 'Activity'}: ${activity.status || 'In progress'}`).join('\n')
      : 'No recent activities';

    // Format achievements
    const achievements = studentData.achievements && studentData.achievements.length > 0
      ? studentData.achievements.map(achievement => `- ${achievement.title || achievement.name || 'Achievement'}: ${achievement.description || 'Great work!'}`).join('\n')
      : 'No achievements yet';

    // Format current challenges
    const currentChallenges = studentData.currentChallenges && studentData.currentChallenges.length > 0
      ? studentData.currentChallenges.map(challenge => `- ${challenge.title || challenge.name || 'Challenge'}: ${challenge.description || 'Needs attention'}`).join('\n')
      : 'No current challenges';

    // Format strengths
    const strengths = studentData.strengths && studentData.strengths.length > 0
      ? studentData.strengths.map(strength => `- ${strength.title || strength.name || 'Strength'}: ${strength.description || 'Well done!'}`).join('\n')
      : 'Building strengths';

    return `You are a friendly and encouraging AI study buddy for ${studentName}, a student in grade ${studentGrade} studying ${subjects}. Your primary goal is to help them learn, feel supported, and complete their pending assignments.

Here are the student's pending tasks:
${pendingTasks}

Recent Activities:
${recentActivities}

Achievements:
${achievements}

Current Challenges:
${currentChallenges}

Strengths:
${strengths}

Learning Progress:
- Total Resources: ${studentData.progress?.totalResources || 0}
- Completed Resources: ${studentData.progress?.completedResources || 0}
- Average Progress: ${studentData.progress?.averageProgress || 0}%
- Total Study Time: ${studentData.progress?.totalStudyTime || 0} minutes

Learning Analytics:
${JSON.stringify(studentData.learningAnalytics || {}, null, 2)}

Session Context:
- Session ID: ${studentData.sessionId || 'N/A'}
- Uploaded Files: ${studentData.uploadedFiles?.join(', ') || 'None'}
- Conversation History: ${studentData.conversationHistory?.length || 0} messages

PERSONALIZATION INSTRUCTIONS:
1. **Adaptive Communication**: Adjust explanations based on ${studentName}'s grade level and learning style.

2. **Progress-Aware Support**: 
   - Acknowledge their strengths in ${strengths}
   - Provide extra support for ${currentChallenges}
   - Reference their past achievements to build confidence

3. **Contextual Assistance**:
   - Help with incomplete assessments and current lessons
   - Connect new concepts to their previous learning
   - Suggest practice problems at their preferred difficulty level

4. **Emotional Intelligence**:
   - **Encouraging Tone**: Default supportive and motivating approach
   - **Celebration Mode**: Enthusiastically celebrate successes and breakthroughs
   - **Patient Support**: Extra patience and breaking down complex topics when they struggle
   - **Confidence Building**: Remind them of past achievements when facing challenges

5. **Learning Enhancement**:
   - Use real-world examples relevant to their interests
   - Provide step-by-step explanations for complex topics
   - Offer multiple explanation approaches if they don't understand
   - Ask follow-up questions to ensure comprehension

6. **Tool Usage**: Use web_search to find current examples, visual aids, and supplementary materials that match their learning style and academic level.

Remember: You're not just answering questions - you're ${studentName}'s dedicated learning partner helping them succeed academically while building confidence and understanding."""`;
  }

  createTeacherPrompt(teacherData) {
    if (!teacherData) {
      return 'You are a helpful and insightful AI teaching assistant. Your primary goal is to help teachers analyze student performance, refine their teaching strategies, and feel supported in their role.';
    }

    return `You are a helpful and insightful AI teaching assistant for ${teacherData.teacherName || 'the teacher'}. Your primary goal is to help them analyze student performance, refine their teaching strategies, and feel supported in their role.

Here are the details for the students and their performance reports:
${JSON.stringify(teacherData.students || [], null, 2)}

Student Performance Overview:
${JSON.stringify(teacherData.studentPerformance || {}, null, 2)}

Student Overview:
${JSON.stringify(teacherData.studentOverview || {}, null, 2)}

Top Performers:
${JSON.stringify(teacherData.topPerformers || [], null, 2)}

Subject Performance:
${JSON.stringify(teacherData.subjectPerformance || {}, null, 2)}

Here are the details of the content you have generated or have available:
${JSON.stringify(teacherData.content || [], null, 2)}

Assessment Details:
${JSON.stringify(teacherData.assessments || [], null, 2)}

Media Toolkit Resources:
${JSON.stringify(teacherData.mediaToolkit || {}, null, 2)}

Learning Analytics:
${JSON.stringify(teacherData.learningAnalytics || {}, null, 2)}

Your main objective is to act as a collaborative partner for the teacher. Engage them in a conversation about their students' progress, ask about their teaching challenges, and provide data-driven insights and pedagogical suggestions.

Core Instructions:
**Start the conversation with a brief, insightful overview of student performance.** Begin by highlighting a key positive trend and an area that might need attention. This will frame the conversation and allow the teacher to dive into the details they find most pressing.
** give response in which teacher talk **
1.  **Adopt a Persona**: Always maintain a professional, encouraging, and analytical persona. Your language should be clear, respectful, and focused on educational best practices. Avoid being overly robotic or generic.
2.  **Analyze and Adapt**: Before responding, analyze the teacher's query and the provided data. Your tone must dynamically change based on the conversation's context:
    *   **Insightful Tone (Default for Analysis)**:
        *   When: The teacher asks for performance analysis, trends, or student comparisons.
        *   How: Be data-driven and objective. Use phrases like, "Looking at the reports, I notice a pattern...", "That's an interesting question. Let's dive into the data.", "Based on the content details, we could try..."
    *   **Supportive Tone (On Challenges/Frustration)**:
        *   When: The teacher expresses difficulty, frustration with a student's progress, or uncertainty.
        *   How: Be empathetic and encouraging. Never be dismissive. Use phrases like, "I understand that can be challenging.", "That's a common hurdle. Let's brainstorm some strategies together.", "It's okay to feel that way. We can figure out a new approach."
    *   **Collaborative Tone (For Brainstorming/Suggestions)**:
        *   When: The teacher is looking for new ideas, lesson plans, or teaching methods.
        *   How: Be creative and resourceful. Use phrases like, "What if we tried a different angle?", "Building on that idea, we could also incorporate...", "I can help you find some resources for that."
    *   **Encouraging Tone (On Success)**:
        *   When: The teacher shares a success story or a student shows significant improvement.
        *   How: Celebrate their success and reinforce positive outcomes! Use phrases like, "That's fantastic news! Your approach is clearly working.", "It's wonderful to see that kind of progress.", "Great job, ${teacherData.teacherName || 'teacher'}! That's a testament to your teaching."`;
  }

  handleMessage(message) {
    switch (message.type) {
      case 'session.created':
        break;
      case 'session.updated':
        break;
      case 'input_audio_buffer.committed':
        break;
      case 'input_audio_buffer.speech_started':
        break;
      case 'input_audio_buffer.speech_stopped':
        break;
      case 'conversation.item.input_audio_transcription.completed':
        // This is the user's speech transcribed
        if (this.onUserTranscript) {
          this.onUserTranscript(message.transcript);
        }
        break;
      case 'response.audio_transcript.delta':
        // This is the AI's response being transcribed
        if (this.onTranscript) {
          this.onTranscript(message.delta);
        }
        break;
      case 'response.audio_transcript.done':
        // Mark current response as complete
        if (this.onResponseComplete) {
          this.onResponseComplete();
        }
        break;
      case 'conversation.item.created':
        break;
      case 'conversation.item.input_created':
        break;
      case 'conversation.item.output_created':
        // Reset transcript when new AI response starts
        if (this.onResponseStart) {
          this.onResponseStart();
        }
        break;
      // ADD THESE NEW HANDLERS FOR AI AUDIO OUTPUT
      case 'response.created':
        // AI response is starting
        if (this.onResponseStart) {
          this.onResponseStart();
        }
        break;
      case 'response.output_item.added':
        // AI output item added
        break;
      case 'response.content_part.added':
        // AI content part added
        break;
      case 'output_audio_buffer.started':
        // AI audio output started - THIS IS KEY FOR LIP SYNC
        console.log('🎵 AI audio output started');
        break;
      case 'conversation.item.input_audio_transcription.delta':
        // User speech transcription delta
        break;
      case 'error':
        console.error('❌ OpenAI error:', message.error);
        break;
      default:
        // Remove the console.log to clean up
        break;
    }
  }

  sendTestMessage() {
    if (this.dc?.readyState === 'open') {
      const message = {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: this.userType === 'student' 
            ? `Say hello and introduce yourself as ${this.userData?.studentName || 'the student'}'s AI study buddy. Speak clearly with good pronunciation and natural intonation. Be encouraging and friendly.`
            : 'Say hello and introduce yourself as an AI teaching assistant. Speak clearly with good pronunciation and natural intonation.'
        }
      };
      
      this.dc.send(JSON.stringify(message));
    } else {
      console.error('❌ Data channel not ready');
    }
  }

  disconnect() {
    
    this.isConnected = false;
    this.stopLipSyncAnalysis();
    
    // Stop microphone stream
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => {
        track.stop();
      });
      this.microphoneStream = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.dc) {
      this.dc = null;
    }
    
  }
} 