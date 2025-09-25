import os
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ServerSelectionTimeoutError
from bson import ObjectId
import asyncio

logger = logging.getLogger(__name__)

class MongoDBManager:
    """Optimized MongoDB manager for direct backend data access"""
    
    def __init__(self):
        self.client = None
        self.db = None
        self.uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.db_name = os.getenv("MONGODB_DB_NAME", "better-auth")
        self._connection_pool = None
        
    async def connect(self):
        """Initialize MongoDB connection with optimized settings"""
        if self.client and self.db:
            return self.db
            
        try:
            # Optimized connection settings for performance
            self.client = AsyncIOMotorClient(
                self.uri,
                maxPoolSize=50,  # Increase pool size for better concurrency
                minPoolSize=10,
                maxIdleTimeMS=30000,
                serverSelectionTimeoutMS=5000,  # Faster timeout
                connectTimeoutMS=10000,
                socketTimeoutMS=20000,
                retryWrites=True
            )
            
            self.db = self.client[self.db_name]
            
            # Test connection
            await self.client.admin.command('ping')
            logger.info("✅ MongoDB connected successfully")
            
            return self.db
            
        except Exception as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            raise
    
    async def get_teacher_complete_data(self, teacher_id: str, teacher_email: str) -> Dict[str, Any]:
        """
        Optimized single query to get all teacher data at once
        This replaces multiple frontend API calls with one efficient backend query
        """
        try:
            if not self.db:
                await self.connect()
            
            teacher_oid = ObjectId(teacher_id)
            
            # Use MongoDB aggregation pipeline for efficient data fetching
            pipeline = [
                {
                    "$match": {"_id": teacher_oid}
                },
                {
                    "$lookup": {
                        "from": "user",
                        "let": {"teacher_id": "$_id"},
                        "pipeline": [
                            {"$match": {"role": "student"}},
                            {"$limit": 100}  # Limit students for performance
                        ],
                        "as": "students"
                    }
                },
                {
                    "$lookup": {
                        "from": "contents",
                        "localField": "_id",
                        "foreignField": "userId",
                        "as": "contents"
                    }
                },
                {
                    "$lookup": {
                        "from": "assessments",
                        "let": {"teacher_id": "$_id"},
                        "pipeline": [
                            {
                                "$match": {
                                    "$or": [
                                        {"userId": {"$eq": "$$teacher_id"}},
                                        {"teacherId": {"$eq": "$$teacher_id"}}
                                    ]
                                }
                            }
                        ],
                        "as": "assessments"
                    }
                },
                {
                    "$lookup": {
                        "from": "presentations",
                        "localField": "_id",
                        "foreignField": "userId",
                        "as": "presentations"
                    }
                },
                {
                    "$lookup": {
                        "from": "comics",
                        "localField": "_id",
                        "foreignField": "userId",
                        "as": "comics"
                    }
                },
                {
                    "$lookup": {
                        "from": "images",
                        "localField": "_id",
                        "foreignField": "userId",
                        "as": "images"
                    }
                },
                {
                    "$lookup": {
                        "from": "videos",
                        "localField": "_id",
                        "foreignField": "userId",
                        "as": "videos"
                    }
                },
                {
                    "$lookup": {
                        "from": "websearches",
                        "localField": "_id",
                        "foreignField": "userId",
                        "as": "websearches"
                    }
                }
            ]
            
            # Execute aggregation
            cursor = self.db.user.aggregate(pipeline)
            result = await cursor.to_list(length=1)
            
            if not result:
                logger.warning(f"No teacher found with ID: {teacher_id}")
                return self._create_fallback_teacher_data(teacher_id, teacher_email)
            
            teacher_data = result[0]
            
            # Process student data with performance calculations
            students_with_performance = await self._process_students_data(teacher_data.get('students', []))
            
            # Build optimized response
            optimized_data = {
                "teacher_name": teacher_data.get('name', teacher_email.split('@')[0]),
                "teacher_id": str(teacher_data['_id']),
                "email": teacher_data.get('email', teacher_email),
                "grades": teacher_data.get('grades', ['Grade 8', 'Grade 9', 'Grade 10']),
                "subjects": teacher_data.get('subjects', ['Mathematics', 'Science', 'English']),
                
                # Student data - optimized
                "student_details_with_reports": students_with_performance[:20],  # Limit to 20 for performance
                "student_performance": self._calculate_student_performance_summary(students_with_performance),
                "student_overview": {
                    "total_students": len(students_with_performance),
                    "average_performance": self._calculate_average_performance(students_with_performance)
                },
                "top_performers": self._get_top_performers(students_with_performance, 5),
                "subject_performance": self._calculate_subject_performance(students_with_performance),
                
                # Content data - optimized
                "generated_content_details": [self._serialize_content(c) for c in teacher_data.get('contents', [])],
                "assessment_details": [self._serialize_content(a) for a in teacher_data.get('assessments', [])],
                
                # Media toolkit - optimized
                "media_toolkit": {
                    "comics": [self._serialize_content(c) for c in teacher_data.get('comics', [])],
                    "images": [self._serialize_content(i) for i in teacher_data.get('images', [])],
                    "slides": [self._serialize_content(p) for p in teacher_data.get('presentations', [])],
                    "videos": [self._serialize_content(v) for v in teacher_data.get('videos', [])],
                    "web_searches": [self._serialize_content(w) for w in teacher_data.get('websearches', [])]
                },
                
                # Media counts - optimized
                "media_counts": {
                    "comics": len(teacher_data.get('comics', [])),
                    "images": len(teacher_data.get('images', [])),
                    "slides": len(teacher_data.get('presentations', [])),
                    "videos": len(teacher_data.get('videos', [])),
                    "webSearch": len(teacher_data.get('websearches', [])),
                    "totalContent": (
                        len(teacher_data.get('contents', [])) +
                        len(teacher_data.get('assessments', [])) +
                        len(teacher_data.get('presentations', [])) +
                        len(teacher_data.get('comics', [])) +
                        len(teacher_data.get('images', [])) +
                        len(teacher_data.get('videos', [])) +
                        len(teacher_data.get('websearches', []))
                    )
                },
                
                # Analytics - optimized
                "learning_analytics": {
                    "totalLessons": len(teacher_data.get('contents', [])),
                    "totalAssessments": len(teacher_data.get('assessments', [])),
                    "averageStudentPerformance": self._calculate_average_performance(students_with_performance),
                    "totalContent": len(teacher_data.get('contents', []))
                },
                
                # Progress and feedback - optimized
                "progress_data": {},
                "feedback_data": []
            }
            
            logger.info(f"✅ Retrieved complete teacher data for {teacher_data.get('name')} - {len(students_with_performance)} students, {optimized_data['media_counts']['totalContent']} content items")
            
            return optimized_data
            
        except Exception as e:
            logger.error(f"❌ Error fetching teacher data: {e}", exc_info=True)
            return self._create_fallback_teacher_data(teacher_id, teacher_email)
    
    async def _process_students_data(self, students: List[Dict]) -> List[Dict]:
        """Process students data with performance calculations"""
        if not students:
            return []
        
        try:
            # Get student IDs for progress lookup
            student_ids = [student['_id'] for student in students]
            
            # Fetch progress data for all students in one query
            progress_cursor = self.db.progress.find(
                {"studentId": {"$in": student_ids}},
                {"studentId": 1, "score": 1, "type": 1}
            )
            progress_data = await progress_cursor.to_list(length=None)
            
            # Group progress by student
            progress_by_student = {}
            for progress in progress_data:
                student_id = str(progress['studentId'])
                if student_id not in progress_by_student:
                    progress_by_student[student_id] = []
                progress_by_student[student_id].append(progress)
            
            # Process each student
            processed_students = []
            for student in students:
                student_id = str(student['_id'])
                student_progress = progress_by_student.get(student_id, [])
                
                performance = self._calculate_student_performance(student_progress)
                
                processed_students.append({
                    "student_name": student.get('name', student.get('email', 'Unknown')),
                    "student_id": student_id,
                    "email": student.get('email', ''),
                    "grades": student.get('grades', []),
                    "subjects": student.get('subjects', []),
                    "performance": performance,
                    "lastActive": student.get('lastLogin', student.get('createdAt', datetime.now())).isoformat() if isinstance(student.get('lastLogin'), datetime) else str(student.get('lastLogin', datetime.now())),
                    "group": student.get('group', 'Default')
                })
            
            return processed_students
            
        except Exception as e:
            logger.error(f"Error processing students data: {e}")
            return []
    
    def _calculate_student_performance(self, student_progress: List[Dict]) -> Dict[str, int]:
        """Calculate student performance metrics"""
        if not student_progress:
            return {
                "overall": 75,
                "assignments": 80,
                "quizzes": 70,
                "participation": 85
            }
        
        total_score = sum(progress.get('score', 0) for progress in student_progress)
        average_score = total_score / len(student_progress)
        
        # Calculate by type
        assignments = [p for p in student_progress if p.get('type') == 'assignment']
        quizzes = [p for p in student_progress if p.get('type') == 'quiz']
        participation = [p for p in student_progress if p.get('type') == 'participation']
        
        assignment_score = sum(p.get('score', 0) for p in assignments) / len(assignments) if assignments else 80
        quiz_score = sum(p.get('score', 0) for p in quizzes) / len(quizzes) if quizzes else 70
        participation_score = sum(p.get('score', 0) for p in participation) / len(participation) if participation else 85
        
        return {
            "overall": round(average_score),
            "assignments": round(assignment_score),
            "quizzes": round(quiz_score),
            "participation": round(participation_score)
        }
    
    def _calculate_student_performance_summary(self, students: List[Dict]) -> Dict[str, Any]:
        """Calculate overall student performance summary"""
        if not students:
            return {"total_students": 0, "average_performance": 75}
        
        total_performance = sum(student.get('performance', {}).get('overall', 75) for student in students)
        average_performance = total_performance / len(students)
        
        return {
            "total_students": len(students),
            "average_performance": round(average_performance)
        }
    
    def _calculate_average_performance(self, students: List[Dict]) -> float:
        """Calculate average performance across all students"""
        if not students:
            return 75.0
        
        total = sum(student.get('performance', {}).get('overall', 75) for student in students)
        return round(total / len(students), 1)
    
    def _get_top_performers(self, students: List[Dict], limit: int = 5) -> List[Dict]:
        """Get top performing students"""
        if not students:
            return []
        
        sorted_students = sorted(
            students,
            key=lambda s: s.get('performance', {}).get('overall', 0),
            reverse=True
        )
        
        return [
            {
                "name": student.get('student_name', 'Unknown'),
                "performance": student.get('performance', {}).get('overall', 75),
                "strengths": student.get('subjects', []),
                "group": student.get('group', 'Default')
            }
            for student in sorted_students[:limit]
        ]
    
    def _calculate_subject_performance(self, students: List[Dict]) -> Dict[str, Dict]:
        """Calculate performance by subject"""
        subject_data = {}
        
        for student in students:
            performance = student.get('performance', {}).get('overall', 75)
            subjects = student.get('subjects', [])
            
            for subject in subjects:
                if subject not in subject_data:
                    subject_data[subject] = {"total": 0, "count": 0, "students": []}
                
                subject_data[subject]["total"] += performance
                subject_data[subject]["count"] += 1
                subject_data[subject]["students"].append({
                    "name": student.get('student_name', 'Unknown'),
                    "score": performance
                })
        
        # Calculate averages
        for subject in subject_data:
            data = subject_data[subject]
            data["average"] = round(data["total"] / data["count"]) if data["count"] > 0 else 75
        
        return subject_data
    
    def _serialize_content(self, content: Dict) -> Dict:
        """Serialize content data for JSON response"""
        if not content:
            return {}
        
        return {
            "_id": str(content.get('_id', '')),
            "title": content.get('title', 'Untitled'),
            "contentType": content.get('contentType', content.get('type', 'unknown')),
            "createdAt": content.get('createdAt', datetime.now()).isoformat() if isinstance(content.get('createdAt'), datetime) else str(content.get('createdAt', '')),
            "subject": content.get('subject', ''),
            "grade": content.get('grade', ''),
            "topic": content.get('topic', content.get('lesson_topic', ''))
        }
    
    def _create_fallback_teacher_data(self, teacher_id: str, teacher_email: str) -> Dict[str, Any]:
        """Create fallback data when teacher is not found"""
        return {
            "teacher_name": teacher_email.split('@')[0] if teacher_email else 'Teacher',
            "teacher_id": teacher_id,
            "email": teacher_email,
            "grades": ['Grade 8', 'Grade 9', 'Grade 10'],
            "subjects": ['Mathematics', 'Science', 'English'],
            "student_details_with_reports": [],
            "student_performance": {"total_students": 0, "average_performance": 75},
            "student_overview": {"total_students": 0, "average_performance": 75},
            "top_performers": [],
            "subject_performance": {},
            "generated_content_details": [],
            "assessment_details": [],
            "media_toolkit": {"comics": [], "images": [], "slides": [], "videos": [], "web_searches": []},
            "media_counts": {"comics": 0, "images": 0, "slides": 0, "videos": 0, "webSearch": 0, "totalContent": 0},
            "learning_analytics": {"totalLessons": 0, "totalAssessments": 0, "averageStudentPerformance": 75, "totalContent": 0},
            "progress_data": {},
            "feedback_data": []
        }
    
    async def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

# Global MongoDB manager instance
mongodb_manager = MongoDBManager()
