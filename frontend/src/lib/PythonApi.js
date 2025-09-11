// Python Backend API Client
class PythonApiClient {
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const isFormData = (typeof FormData !== 'undefined') && options.body instanceof FormData;
    const baseHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
    const config = {
      headers: {
        ...baseHeaders,
        ...(options.headers || {}),
      },
      ...options,
    };

    try {
      console.log(`Making request to: ${url}`, config);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const responseText = await response.text();
        try {
          // Try to parse the error response as JSON
          const errorJson = JSON.parse(responseText);
          throw new Error(errorJson.detail || errorJson.error || `Request failed: ${response.status}`);
        } catch (e) {
          // If it's not JSON, the responseText itself is the error
          throw new Error(`Server error (${response.status}): ${responseText}`);
        }
      }
      
      // Handle successful responses
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        console.log(`Python API response:`, data);
        return data;
      }
      
      // Handle cases where the response is not JSON
      return response.text();

    } catch (error) {
      console.error(`Python API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Assessment endpoints
  async generateAssessment(assessmentData) {
    // Transform frontend data to match Python backend schema
    const selectedTypes = this.getSelectedQuestionTypes(assessmentData.questionTypes);
    const questionDistribution = this.distributeQuestions(parseInt(assessmentData.numQuestions), selectedTypes);
    
    // Map the assessment_type to assessment_types for the backend
    const assessmentTypes = selectedTypes.length === 1 
      ? this.mapSingleQuestionType(selectedTypes[0])
      : selectedTypes.map(type => this.mapSingleQuestionType(type)).join(', ');
    
    const pythonSchema = {
      test_title: assessmentData.title,
      grade_level: assessmentData.grade,
      subject: assessmentData.subject,
      topic: assessmentData.topic,
      assessment_type: selectedTypes.length === 1 ? this.mapSingleQuestionType(selectedTypes[0]) : 'Mixed',
      assessment_types: assessmentTypes,
      question_types: selectedTypes,
      question_distribution: questionDistribution,
      test_duration: `${assessmentData.duration} minutes`,
      number_of_questions: parseInt(assessmentData.numQuestions),
      difficulty_level: this.capitalizeDifficulty(assessmentData.difficulty),
      user_prompt: this.buildUserPrompt(assessmentData),
      learning_objectives: assessmentData.learningObjectives || '',
      anxiety_triggers: assessmentData.anxietyTriggers || '',
      language: assessmentData.language || 'English',
    };

    console.log('Sending assessment request:', pythonSchema);
    return this.makeRequest('/assessment_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // Content generation endpoints
  async generateContent(contentData) {
    // map frontend feature toggles to generator options
    const additional_ai_options = [];
    if (contentData.adaptiveLevel) additional_ai_options.push('adaptive difficulty');
    if (contentData.includeAssessment) additional_ai_options.push('include assessment');
    if (contentData.multimediaSuggestions) additional_ai_options.push('multimedia suggestion');
    
    // Add slide generation option
    if (contentData.generateSlides) additional_ai_options.push('generate slides');

    const pythonSchema = {
      content_type: contentData.contentType.replace('-', ' '), // "lesson plan" | "worksheet" | "presentation" | "quiz"
      subject: contentData.subject,
      lesson_topic: contentData.topic,
      grade: `${contentData.grade}th Grade`,
      learning_objective: contentData.objectives || 'Not specified',
      emotional_consideration: contentData.emotionalFlags || 'None',
      // allow both old/new forms; backend accepts both via regex
      instructional_depth: contentData.instructionalDepth || 'standard',     // e.g., 'standard' | 'basic' | 'advanced' | 'low' | 'high'
      content_version: contentData.contentVersion || 'standard',             // e.g., 'standard' | 'simplified' | 'enriched' | 'low' | 'high'
      web_search_enabled: contentData.webSearchEnabled !== false,
      additional_ai_options: additional_ai_options.length ? additional_ai_options : undefined,
      language: contentData.language || 'English', // Always include language parameter with English default
    };

    console.log('Sending content request:', pythonSchema);
    return this.makeRequest('/teaching_content_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // NEW: Presentation generation endpoint
  async generatePresentation(presentationData) {
    // Transform frontend data to match Python backend schema
    const pythonSchema = {
      plain_text: presentationData.topic,
      custom_user_instructions: presentationData.instructions || '',
      length: parseInt(presentationData.slideCount),
      language: presentationData.language === 'Arabic' ? 'ARABIC' : 'ENGLISH',
      fetch_images: presentationData.includeImages !== false,
      verbosity: presentationData.verbosity || 'standard',
      template: presentationData.template || 'default'
    };

    console.log('Sending presentation request:', pythonSchema);
    return this.makeRequest('/presentation_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // NEW: Slide generation from content endpoint
  async generateSlidesFromContent(contentData) {
    const pythonSchema = {
      plain_text: contentData.content,
      custom_user_instructions: `Generate presentation slides based on this content for ${contentData.topic}`,
      length: parseInt(contentData.slideCount) || 10,
      language: contentData.language === 'Arabic' ? 'ARABIC' : 'ENGLISH',
      fetch_images: true,
      verbosity: 'standard',
      template: contentData.template || 'default'
    };

    console.log('Sending slides from content request:', pythonSchema);
    return this.makeRequest('/presentation_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // Enhanced Chatbot endpoint with student data
  async sendChatMessageWithStudentData(sessionId, query, studentData, files = [], history = [], webSearchEnabled = true) {
    const pythonSchema = {
      session_id: sessionId,
      query: query,
      history: history,
      web_search_enabled: true, // Always enable web search
      student_data: {
        id: studentData.id,
        email: studentData.email,
        name: studentData.name,
        grade: studentData.grade,
        progress: studentData.progress,
        achievements: studentData.achievements,
        learning_stats: studentData.learningStats,
        assessments: studentData.assessments,
        lessons: studentData.lessons,
        resources: studentData.resources,
        analytics: studentData.analytics
      }
    };

    console.log('Sending chatbot request with student data:', pythonSchema);
    return this.makeRequest('/chatbot_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // Chatbot streaming endpoint - FIXED VERSION with data transformation
  async startChatbotStream(sessionId, query, studentData, files = [], history = [], webSearchEnabled = true) {
    const url = `${this.baseUrl}/chatbot_endpoint`;
    
    // Transform student data to match Python backend schema
    const transformedStudentData = {
      id: studentData.id,
      email: studentData.email,
      name: studentData.name,
      grade: studentData.grade,
      progress: studentData.progress,
      // Fix: Ensure achievements is always a list
      achievements: Array.isArray(studentData.achievements) ? studentData.achievements : 
                   (studentData.achievements && studentData.achievements.achievements ? studentData.achievements.achievements : []),
      learning_stats: studentData.learningStats,
      assessments: studentData.assessments,
      lessons: studentData.lessons,
      resources: studentData.resources,
      analytics: studentData.analytics
    };

    // Extract file names from File objects for context
    const uploadedFileNames = files.map(file => file.name);

    const payload = {
      session_id: sessionId,
      query: query,
      history: history,
      web_search_enabled: true, // Always enable web search
      student_data: transformedStudentData,
      uploaded_files: uploadedFileNames  // NEW: Pass uploaded file names for context
    };

    console.log('Starting chatbot stream with payload:', payload);
    console.log('Making request to:', url);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  // NEW: Document upload endpoint for chatbot
  async uploadDocumentsForChatbot(sessionId, files) {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    
    if (files && files.length > 0) {
      files.forEach((file, index) => {
        formData.append('files', file);
      });
    }

    return this.makeRequest('/upload_documents_endpoint', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  }

  // NEW: Document upload endpoint for TEACHER chatbot
  async uploadDocumentsForTeacherChatbot(sessionId, files) {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    
    if (files && files.length > 0) {
      files.forEach((file, index) => {
        formData.append('files', file);
      });
    }

    return this.makeRequest('/teacher_upload_document_endpoint', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  }

  // Legacy chatbot endpoint (for backward compatibility)
  async sendChatMessage(sessionId, query, files = [], history = [], webSearchEnabled = true) {
    const formData = new FormData();
    
    // Add request data
    formData.append('request', JSON.stringify({
      session_id: sessionId,
      query: query,
      history: history,
      web_search_enabled: true // Always enable web search
    }));

    // Add files if any
    if (files && files.length > 0) {
      files.forEach((file, index) => {
        formData.append('files', file);
      });
    }

    return this.makeRequest('/chatbot_endpoint', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  }

  // Health check
  async healthCheck() {
    return this.makeRequest('/health', {
      method: 'GET'
    });
  }

  // Helper methods
  getSelectedQuestionTypes(questionTypes) {
    const selected = [];
    if (questionTypes.mcq) selected.push('mcq');
    if (questionTypes.true_false) selected.push('true_false');
    if (questionTypes.short_answer) selected.push('short_answer');
    return selected;
  }

  distributeQuestions(totalQuestions, questionTypes) {
    if (questionTypes.length === 1) {
      return { [questionTypes[0]]: totalQuestions };
    }

    const distribution = {};
    const questionsPerType = Math.floor(totalQuestions / questionTypes.length);
    const remainder = totalQuestions % questionTypes.length;

    questionTypes.forEach((type, index) => {
      distribution[type] = questionsPerType + (index < remainder ? 1 : 0);
    });

    return distribution;
  }

  mapSingleQuestionType(type) {
    const typeMap = {
      'mcq': 'MCQ',
      'true_false': 'True or False',
      'short_answer': 'Short Answer'
    };
    return typeMap[type] || 'MCQ';
  }

  buildUserPrompt(assessmentData) {
    let prompt = '';
    
    if (assessmentData.learningObjectives) {
      prompt += `Learning Objectives: ${assessmentData.learningObjectives}. `;
    }
    
    if (assessmentData.anxietyTriggers) {
      prompt += `Consider these anxiety factors: ${assessmentData.anxietyTriggers}. `;
    }
    
    if (assessmentData.customPrompt) {
      prompt += assessmentData.customPrompt;
    }
    
    return prompt || 'None.';
  }

  // Legacy method for backward compatibility
  mapQuestionTypesToPython(questionTypes) {
    if (questionTypes.true_false) return 'True or False';
    if (questionTypes.short_answer) return 'Short Answer';
    if (questionTypes.mcq) return 'MCQ';
    return 'MCQ'; // Default fallback
  }

  // Image generation endpoint
  async generateImage(imageData) {
    const pythonSchema = {
      topic: imageData.topic,
      grade_level: imageData.gradeLevel || '8',
      preferred_visual_type: imageData.preferred_visual_type, // Fix: use the field name that's being sent from frontend
      subject: imageData.subject,
      difficulty_flag: (imageData.difficultyFlag ? 'true' : 'false'),
      instructions: imageData.instructions,
      language: imageData.language || 'English',
    };

    console.log('Sending image generation request:', pythonSchema);
    return this.makeRequest('/image_generation_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema),
    });
  }

  // Web search endpoint
  async runWebSearch(searchData) {
    const pythonSchema = {
      topic: searchData.topic,
      grade_level: searchData.gradeLevel || '8', // Use auto-detected grade
      subject: searchData.subject,
      content_type: searchData.contentType, // e.g., 'articles', 'videos'
      language: searchData.language || 'English',
      comprehension: searchData.comprehension || 'intermediate',
      max_results: parseInt(searchData.maxResults),
    };

    console.log('Sending web search request:', pythonSchema);
    return this.makeRequest('/web_search_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema),
    });
  }

  // Comics streaming: returns the raw fetch Response
  async startComicsStream(comicsData) {
    const url = `${this.baseUrl}/comics_stream_endpoint`;
    const payload = {
      instructions: comicsData.instructions,
      grade_level: comicsData.gradeLevel || '8', // Use auto-detected grade
      num_panels: parseInt(comicsData.numPanels),
      language: comicsData.language || 'English', // Add language parameter with English default
    };
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // NEW: Voice functionality methods
  async startVoiceSession(studentData) {
    const url = `${this.baseUrl.replace('http', 'ws')}/ws/voice`;
    console.log('Connecting to voice WebSocket:', url);
    return new WebSocket(url);
  }

  // NEW: Teacher Voice functionality methods
  async startTeacherVoiceSession(teacherData) {
    const url = `${this.baseUrl.replace('http', 'ws')}/ws/teacher-voice`;
    console.log('Connecting to teacher voice WebSocket:', url);
    return new WebSocket(url);
  }

  // NEW: Teacher bulk data submission endpoint
  async submitTeacherBulkData(teacherData) {
    const pythonSchema = {
      teacher_name: teacherData.teacherName,
      student_details_with_reports: teacherData.students,
      generated_content_details: teacherData.content,
      feedback_data: teacherData.feedback,
      learning_analytics: teacherData.analytics
    };

    console.log('Sending teacher bulk data:', pythonSchema);
    return this.makeRequest('/teacher_bulk_data_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // Teacher voice chat endpoint for text-based chatbot
  async startTeacherVoiceChat(teacherData, sessionId, query = '') {
    const url = `${this.baseUrl}/teacher_voice_chat_endpoint`;
    
    // Transform teacher data to match backend schema
    const transformedTeacherData = {
      teacher_name: teacherData.teacherName || teacherData.teacher_name,
      teacher_id: teacherData.teacherId || teacherData.teacher_id,
      
      // Student data
      student_details_with_reports: teacherData.students || [],
      student_performance: teacherData.studentPerformance || {},
      student_overview: teacherData.studentOverview || {},
      top_performers: teacherData.topPerformers || [],
      subject_performance: teacherData.subjectPerformance || [],
      behavior_analysis: teacherData.behaviorAnalysis || {},
      attendance_data: teacherData.attendanceData || {},
      
      // Content and assessments
      generated_content_details: teacherData.content || [],
      assessment_details: teacherData.assessments || [],
      
      // Media toolkit
      media_toolkit: teacherData.mediaToolkit || {},
      media_counts: teacherData.mediaCount || {},
      
      // Progress and feedback
      progress_data: teacherData.progress || {},
      feedback_data: teacherData.feedback || [],
      
      // Learning analytics
      learning_analytics: teacherData.learningAnalytics || {}
    };

    const payload = {
      session_id: sessionId,
      query: query, // ADD THIS LINE
      history: [], // ADD THIS LINE
      teacher_data: transformedTeacherData,
      web_search_enabled: true, // ADD THIS LINE
      uploaded_files: [] // ADD THIS LINE
    };

    console.log('Starting teacher voice chat with comprehensive payload:', payload);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      return response;
    } catch (error) {
      console.error('Teacher voice chat error:', error);
      throw error;
    }
  }

  // NEW: Video presentation generation endpoint
  async generateVideoPresentation(videoData) {
    const formData = new FormData();
    formData.append('pptx_file', videoData.pptx_file);
    formData.append('voice_id', videoData.voice_id);
    formData.append('talking_photo_id', videoData.talking_photo_id);
    formData.append('title', videoData.title);

    console.log('Sending video presentation request:', {
      voice_id: videoData.voice_id,
      talking_photo_id: videoData.talking_photo_id,
      title: videoData.title,
      file_name: videoData.pptx_file.name
    });

    return this.makeRequest('/video_presentation_endpoint', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  }

  // Helper method to capitalize difficulty level
  capitalizeDifficulty(difficulty) {
    const difficultyMap = {
      'easy': 'Easy',
      'medium': 'Medium', 
      'hard': 'Hard'
    };
    return difficultyMap[difficulty?.toLowerCase()] || 'Medium';
  }
}

export default new PythonApiClient();