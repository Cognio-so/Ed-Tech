// Client-side API functions for better performance
export const clientAPI = {
  async getAllStudentContent() {
    try {
      const response = await fetch('/api/student/learning-library', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching content:', error);
      throw new Error(error.message || 'Failed to fetch content');
    }
  },

  async getLessonStats() {
    try {
      const response = await fetch('/api/student/learning-library/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching lesson stats:', error);
      throw new Error(error.message || 'Failed to fetch lesson statistics');
    }
  },

  async updateStudentProgress(contentId, completionData = {}) {
    try {
      const response = await fetch('/api/student/learning-library/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId,
          completionData
        }),
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating student progress:', error);
      throw new Error(error.message || 'Failed to update progress');
    }
  },

  async getLessonById(lessonId) {
    try {
      const response = await fetch(`/api/student/learning-library/${lessonId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching lesson by ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};
