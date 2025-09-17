// Achievement types and criteria
export const ACHIEVEMENT_TYPES = {
  // Progress-based achievements
  FIRST_STEP: {
    id: 'first_lesson',
    name: 'First Steps',
    description: 'Complete your first learning content',
    icon: '👶',
    color: 'from-blue-400 to-blue-600',
    criteria: { completedContent: 1 },
    points: 10,
    category: 'progress'
  },
  DEDICATED_LEARNER: {
    id: 'dedicated_learner',
    name: 'Dedicated Learner',
    description: 'Complete 5 learning contents',
    icon: '📚',
    color: 'from-green-400 to-green-600',
    criteria: { completedContent: 5 },
    points: 25,
    category: 'progress'
  },
  KNOWLEDGE_SEEKER: {
    id: 'knowledge_seeker',
    name: 'Knowledge Seeker',
    description: 'Complete 10 learning contents',
    icon: '🔍',
    color: 'from-purple-400 to-purple-600',
    criteria: { completedContent: 10 },
    points: 50,
    category: 'progress'
  },
  LEARNING_CHAMPION: {
    id: 'learning_champion',
    name: 'Learning Champion',
    description: 'Complete 25 learning contents',
    icon: '🏆',
    color: 'from-yellow-400 to-yellow-600',
    criteria: { completedContent: 25 },
    points: 100,
    category: 'progress'
  },
  LEARNING_MASTER: {
    id: 'learning_master',
    name: 'Learning Master',
    description: 'Complete 50 learning contents',
    icon: '👑',
    color: 'from-red-400 to-red-600',
    criteria: { completedContent: 50 },
    points: 200,
    category: 'progress'
  },

  // Time-based achievements
  TIME_INVESTOR: {
    id: 'time_investor',
    name: 'Time Investor',
    description: 'Spend 5 hours learning',
    icon: '⏰',
    color: 'from-indigo-400 to-indigo-600',
    criteria: { totalTimeSpent: 300 }, // 5 hours in minutes
    points: 30,
    category: 'time'
  },
  TIME_MASTER: {
    id: 'time_master',
    name: 'Time Master',
    description: 'Spend 25 hours learning',
    icon: '⏳',
    color: 'from-teal-400 to-teal-600',
    criteria: { totalTimeSpent: 1500 }, // 25 hours in minutes
    points: 75,
    category: 'time'
  },
  TIME_LEGEND: {
    id: 'time_legend',
    name: 'Time Legend',
    description: 'Spend 100 hours learning',
    icon: '🕰️',
    color: 'from-pink-400 to-pink-600',
    criteria: { totalTimeSpent: 6000 }, // 100 hours in minutes
    points: 150,
    category: 'time'
  },

  // Performance-based achievements
  PERFECTIONIST: {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Score 100% on an assessment',
    icon: '🏆',
    color: 'from-emerald-400 to-emerald-600',
    criteria: { perfectScore: 1 },
    points: 50,
    category: 'performance'
  },
  HIGH_ACHIEVER: {
    id: 'high_achiever',
    name: 'High Achiever',
    description: 'Maintain 90%+ average score',
    icon: '⭐',
    color: 'from-amber-400 to-amber-600',
    criteria: { averageScore: 90 },
    points: 75,
    category: 'performance'
  },
  CONSISTENT_PERFORMER: {
    id: 'consistent_performer',
    name: 'Consistent Performer',
    description: 'Score 80%+ on 10 assessments',
    icon: '🎯',
    color: 'from-cyan-400 to-cyan-600',
    criteria: { goodScores: 10 },
    points: 60,
    category: 'performance'
  },

  // Subject-specific achievements
  MATH_WHIZ: {
    id: 'math_whiz',
    name: 'Math Whiz',
    description: 'Complete 5 Math contents with 85%+ average',
    icon: '🧮',
    color: 'from-orange-400 to-orange-600',
    criteria: { subject: 'Math', completedContent: 5, averageScore: 85 },
    points: 40,
    category: 'subject'
  },
  SCIENCE_EXPLORER: {
    id: 'science_explorer',
    name: 'Science Explorer',
    description: 'Complete 5 Science contents with 85%+ average',
    icon: '🔬',
    color: 'from-lime-400 to-lime-600',
    criteria: { subject: 'Science', completedContent: 5, averageScore: 85 },
    points: 40,
    category: 'subject'
  },
  LANGUAGE_ARTIST: {
    id: 'language_artist',
    name: 'Language Artist',
    description: 'Complete 5 English contents with 85%+ average',
    icon: '📝',
    color: 'from-rose-400 to-rose-600',
    criteria: { subject: 'English', completedContent: 5, averageScore: 85 },
    points: 40,
    category: 'subject'
  },

  // Streak achievements
  DAILY_LEARNER: {
    id: 'daily_learner',
    name: 'Daily Learner',
    description: 'Learn for 7 consecutive days',
    icon: '📅',
    color: 'from-violet-400 to-violet-600',
    criteria: { streak: 7 },
    points: 35,
    category: 'streak'
  },
  WEEKLY_WARRIOR: {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    description: 'Learn for 30 consecutive days',
    icon: '🗓️',
    color: 'from-sky-400 to-sky-600',
    criteria: { streak: 30 },
    points: 80,
    category: 'streak'
  },

  // Special achievements
  FEEDBACK_GIVER: {
    id: 'feedback_giver',
    name: 'Feedback Giver',
    description: 'Provide feedback on 5 completed contents',
    icon: '💬',
    color: 'from-emerald-400 to-emerald-600',
    criteria: { feedbackCount: 5 },
    points: 25,
    category: 'special'
  },
  BOOKMARK_COLLECTOR: {
    id: 'bookmark_collector',
    name: 'Bookmark Collector',
    description: 'Bookmark 10 learning contents',
    icon: '🔖',
    color: 'from-fuchsia-400 to-fuchsia-600',
    criteria: { bookmarkedContent: 10 },
    points: 20,
    category: 'special'
  },
  EARLY_BIRD: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete content within 24 hours of starting',
    icon: '⏰',
    color: 'from-sunrise-400 to-sunrise-600',
    criteria: { quickCompletion: 1 },
    points: 15,
    category: 'special'
  }
};
