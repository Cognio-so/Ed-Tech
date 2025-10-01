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
        return data;
      }
      
      // Handle cases where the response is not JSON
      return response.text();

    } catch (error) {
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
      // Add session fields for lesson plans
      number_of_sessions: contentData.numberOfSessions || '1',
      session_duration: contentData.sessionDuration || '45 minutes',
    };

    return this.makeRequest('/teaching_content_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // NEW: Presentation generation endpoint
  async generatePresentation(presentationData) {
    // The data mapping from form names (e.g., topic) to API names (e.g., plain_text)
    // is now handled in action.js. This function receives the correctly structured object.
    // It only needs to perform final transformations, like casing for the language field.
    const pythonSchema = {
      ...presentationData, // Pass all properties from the already-transformed object
      language: presentationData.language === 'Arabic' ? 'ARABIC' : 'ENGLISH',
    };

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
      language: contentData.language === "arabic" ? "ARABIC" : "ENGLISH", // ✅ This is correct for content form
      fetch_images: true,
      verbosity: 'standard',
      template: contentData.template || 'default'
    };

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

    return this.makeRequest('/chatbot_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // Chatbot streaming endpoint - FIXED VERSION with data transformation
  async startChatbotStream(sessionId, query, studentData, files = [], history = [], webSearchEnabled = true, useFeedback = false) {
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
      analytics: studentData.analytics,
      // NEW: Include teacher feedback if available
      teacher_feedback: studentData.teacher_feedback || null
    };

    // Extract file names from File objects for context
    const uploadedFileNames = files.map(file => file.name);

    const payload = {
      session_id: sessionId,
      query: query,
      history: history,
      web_search_enabled: true, // Always enable web search
      student_data: transformedStudentData,
      uploaded_files: uploadedFileNames,
      use_feedback: useFeedback // NEW: Add feedback flag
    };

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

    // FIXED: Return the full response to get filenames
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

    return this.makeRequest('/web_search_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema),
    });
  }

  // Comics streaming: returns the raw fetch Response
  async startComicsStream(comicsData, signal) { // FIX: Accept signal as an argument
    const url = `${this.baseUrl}/comics_stream_endpoint`;
    const payload = {
      instructions: comicsData.instructions,
      grade_level: comicsData.gradeLevel || '8', // Correctly maps gradeLevel to grade_level
      num_panels: parseInt(comicsData.numPanels),
      language: comicsData.language || 'English',
    };
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal, // FIX: Pass the signal to the fetch request
    });
  }

  // NEW: Teacher Voice functionality methods
  async startTeacherVoiceSession(teacherData) {
    const url = `${this.baseUrl.replace('http', 'ws')}/ws/teacher-voice`;
    
    const ws = new WebSocket(url);
    
    // Send teacher data when connection opens
    ws.onopen = () => {
      ws.send(JSON.stringify(teacherData));
    };
    
    return ws;
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

    return this.makeRequest('/teacher_bulk_data_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema)
    });
  }

  // OPTIMIZED: Teacher chat endpoint for text-based chatbot
  async startTeacherChat(teacherData, sessionId, query = '', history = [], uploadedFiles = []) {
    const url = `${this.baseUrl}/teacher_chat_endpoint`;
    
    // OPTIMIZED: Pass only essential teacher data to reduce payload size
    const optimizedTeacherData = {
      // Basic teacher info
      teacher_name: teacherData.teacher_name,
      teacher_id: teacherData.teacher_id,
      email: teacherData.email,
      grades: teacherData.grades || [],
      subjects: teacherData.subjects || [],
      
      // Student data - limit to essential fields only
      student_details_with_reports: (teacherData.student_details_with_reports || []).slice(0, 5).map(student => ({
        student_name: student.student_name,
        student_id: student.student_id,
        performance: {
          overall: student.performance?.overall || 75
        }
      })),
      
      // Performance summary
      student_performance: {
        total_students: teacherData.student_performance?.total_students || 0,
        average_performance: teacherData.student_performance?.average_performance || 75
      },
      
      // Top performers - limit to 3
      top_performers: (teacherData.top_performers || []).slice(0, 3),
      
      // Subject performance - limit data
      subject_performance: teacherData.subject_performance || {},
      
      // Content data - only counts and titles
      generated_content_details: (teacherData.generated_content_details || []).slice(0, 5),
      assessment_details: (teacherData.assessment_details || []).slice(0, 3),
      
      // Media counts
      media_counts: teacherData.media_counts || {},
      
      // Learning analytics
      learning_analytics: teacherData.learning_analytics || {}
    };

    const payload = {
      session_id: sessionId,
      query: query,
      history: history,
      teacher_data: optimizedTeacherData,
      web_search_enabled: true,
      uploaded_files: uploadedFiles
    };

    console.log('Starting optimized teacher chat:', {
      sessionId,
      query: query.substring(0, 100) + '...',
      teacherDataSize: JSON.stringify(optimizedTeacherData).length,
      historyLength: history.length,
      uploadedFilesLength: uploadedFiles.length,
      schemaFields: Object.keys(optimizedTeacherData)
    });
    
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
      console.error('Error starting teacher chat:', error);
      throw error;
    }
  }

  // NEW: Teacher voice endpoint initialization
  async initializeTeacherVoice() {
    const url = `${this.baseUrl}/teacher_voice_endpoint`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
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

    return this.makeRequest('/video_presentation_endpoint', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  }

  // NEW: Perform web search for teacher
  async performWebSearch(searchData) {
    const pythonSchema = {
      topic: searchData.topic,
      grade_level: searchData.gradeLevel || '8',
      subject: searchData.subject,
      content_type: searchData.contentType || 'articles',
      language: searchData.language || 'English',
      comprehension: searchData.comprehension || 'intermediate',
      max_results: parseInt(searchData.maxResults) || 5,
    };

    return this.makeRequest('/web_search_endpoint', {
      method: 'POST',
      body: JSON.stringify(pythonSchema),
    });
  }

  // Get health status
  async getHealth() {
    return this.makeRequest('/health', {
      method: 'GET'
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

  // NEW: Student voice session initialization (WebSocket)
  async startStudentVoiceSession(studentData) {
    const url = `${this.baseUrl.replace('http', 'ws')}/ws/student-voice`;
    
    const ws = new WebSocket(url);
    
    // Send student data when connection opens
    ws.onopen = () => {
      ws.send(JSON.stringify(studentData));
    };
    
    return ws;
  }

  // NEW: Student chat endpoint for text-based chatbot
  async startStudentChat(studentData, sessionId, query = '', files = [], history = [], webSearchEnabled = true) {
    const url = `${this.baseUrl}/chatbot_endpoint`;
    
    try {
      const uploadedFileNames = files.map(file => file.name);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          query: query,
          history: history,
          web_search_enabled: webSearchEnabled,
          student_data: studentData,
          uploaded_files: uploadedFileNames
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
}

export default new PythonApiClient();