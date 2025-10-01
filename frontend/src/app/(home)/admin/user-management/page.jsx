"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Users, 
  UserCheck, 
  UserX, 
  Shield,
  GraduationCap,
  User,
  BookOpen,
  School,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

// Import server actions
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser, 
  getUserStats,
  getSubjectsAndGrades,
  createSubject,
  createGrade,
  updateGrade,
  deleteSubject,
  deleteGrade
} from "./action";

// Import grade and subject data
import { grade, subject } from "@/config/data";

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createSubjectDialogOpen, setCreateSubjectDialogOpen] = useState(false);
  const [createGradeDialogOpen, setCreateGradeDialogOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    grades: [],
    subjects: []
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "student",
    emailVerified: false,
    grades: [],
    subjects: []
  });

  // Subject and Grade management states
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableGrades, setAvailableGrades] = useState([]);
  const [loadingSubjectsGrades, setLoadingSubjectsGrades] = useState(true);
  const [createSubjectForm, setCreateSubjectForm] = useState({
    name: ""
  });
  const [createGradeForm, setCreateGradeForm] = useState({
    grade_number: ""
  });
  const [editGradeDialogOpen, setEditGradeDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [editGradeForm, setEditGradeForm] = useState({
    grade_number: ""
  });

  const limit = 10;

  // Fetch users, stats, subjects and grades
  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, statsData, subjectsGradesData] = await Promise.all([
        getUsers(currentPage, limit, searchTerm, roleFilter === "all" ? "" : roleFilter),
        getUserStats(),
        getSubjectsAndGrades()
      ]);
      
      setUsers(usersData.users);
      setTotalPages(usersData.totalPages);
      setStats(statsData);
      
      if (subjectsGradesData.success) {
        setAvailableSubjects(subjectsGradesData.subjects);
        setAvailableGrades(subjectsGradesData.grades);
      }
    } catch (error) {
      toast.error("Failed to fetch data");
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingSubjectsGrades(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, searchTerm, roleFilter]);

  // Handle create user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", createForm.name);
      formData.append("email", createForm.email);
      formData.append("password", createForm.password);
      formData.append("role", createForm.role);
      formData.append("grades", JSON.stringify(createForm.grades));
      formData.append("subjects", JSON.stringify(createForm.subjects));

      const result = await createUser(formData);
      
      if (result.success) {
        toast.success(result.message);
        setCreateDialogOpen(false);
        setCreateForm({ name: "", email: "", password: "", role: "student", grades: [], subjects: [] });
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to create user");
    }
  };

  // Handle update user
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("email", editForm.email);
      formData.append("role", editForm.role);
      formData.append("emailVerified", editForm.emailVerified.toString());
      formData.append("grades", JSON.stringify(editForm.grades));
      formData.append("subjects", JSON.stringify(editForm.subjects));

      const result = await updateUser(selectedUser.id, formData);
      
      if (result.success) {
        toast.success(result.message);
        setEditDialogOpen(false);
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    try {
      const result = await deleteUser(selectedUser.id);
      
      if (result.success) {
        toast.success(result.message);
        setDeleteDialogOpen(false);
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  // Open edit dialog
  const openEditDialog = async (user) => {
    try {
      const userData = await getUserById(user.id);
      setSelectedUser(userData);
      setEditForm({
        name: userData.name,
        email: userData.email,
        role: userData.role,
        emailVerified: userData.emailVerified,
        grades: userData.grades || [],
        subjects: userData.subjects || []
      });
      setEditDialogOpen(true);
    } catch (error) {
      toast.error("Failed to load user data");
    }
  };

  // Open view dialog
  const openViewDialog = async (user) => {
    try {
      const userData = await getUserById(user.id);
      setSelectedUser(userData);
      setViewDialogOpen(true);
    } catch (error) {
      toast.error("Failed to load user data");
    }
  };

  // Handle subject selection
  const handleSubjectToggle = (subjectName, formType) => {
    if (formType === "create") {
      setCreateForm(prev => ({
        ...prev,
        subjects: prev.subjects.includes(subjectName)
          ? prev.subjects.filter(s => s !== subjectName)
          : [...prev.subjects, subjectName]
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        subjects: prev.subjects.includes(subjectName)
          ? prev.subjects.filter(s => s !== subjectName)
          : [...prev.subjects, subjectName]
      }));
    }
  };

  // Handle grade selection - single selection for students, multiple for teachers
  const handleGradeToggle = (gradeName, formType) => {
    if (formType === "create") {
      setCreateForm(prev => {
        // For students, allow only single grade selection
        if (prev.role === "student") {
          return {
            ...prev,
            grades: prev.grades.includes(gradeName) ? [] : [gradeName]
          };
        }
        // For teachers, allow multiple grade selection
        return {
          ...prev,
          grades: prev.grades.includes(gradeName)
            ? prev.grades.filter(g => g !== gradeName)
            : [...prev.grades, gradeName]
        };
      });
    } else {
      setEditForm(prev => {
        // For students, allow only single grade selection
        if (prev.role === "student") {
          return {
            ...prev,
            grades: prev.grades.includes(gradeName) ? [] : [gradeName]
          };
        }
        // For teachers, allow multiple grade selection
        return {
          ...prev,
          grades: prev.grades.includes(gradeName)
            ? prev.grades.filter(g => g !== gradeName)
            : [...prev.grades, gradeName]
        };
      });
    }
  };

  // Handle create subject (without description)
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", createSubjectForm.name);

      const result = await createSubject(formData);
      
      if (result.success) {
        toast.success(result.message);
        setCreateSubjectDialogOpen(false);
        setCreateSubjectForm({ name: "" });
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to create subject");
    }
  };

  // Handle create grade
  const handleCreateGrade = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("grade_number", createGradeForm.grade_number);

      const result = await createGrade(formData);
      
      if (result.success) {
        toast.success(result.message);
        setCreateGradeDialogOpen(false);
        setCreateGradeForm({ grade_number: "" });
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to create grade");
    }
  };

  // Handle edit grade
  const handleEditGrade = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("grade_number", editGradeForm.grade_number);

      const result = await updateGrade(editingGrade.id, formData);
      
      if (result.success) {
        toast.success(result.message);
        setEditGradeDialogOpen(false);
        setEditingGrade(null);
        setEditGradeForm({ grade_number: "" });
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to update grade");
    }
  };

  // Handle delete subject
  const handleDeleteSubject = async (subjectId) => {
    try {
      const result = await deleteSubject(subjectId);
      
      if (result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to delete subject");
    }
  };

  // Handle delete grade
  const handleDeleteGrade = async (gradeId) => {
    try {
      const result = await deleteGrade(gradeId);
      
      if (result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to delete grade");
    }
  };

  // Open edit grade dialog
  const openEditGradeDialog = (grade) => {
    setEditingGrade(grade);
    setEditGradeForm({
      grade_number: grade.name
    });
    setEditGradeDialogOpen(true);
  };

  // Get role badge variant
  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case "admin": return "destructive";
      case "teacher": return "default";
      case "student": return "secondary";
      default: return "outline";
    }
  };

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role) {
      case "admin": return <Shield className="h-3 w-3" />;
      case "teacher": return <GraduationCap className="h-3 w-3" />;
      case "student": return <User className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage users, roles, grades, and subjects</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verifiedUsers || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unverified Users</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unverifiedUsers || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.roleStats?.admin || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users List</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Manage all users in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Grades</TableHead>
                          <TableHead>Subjects</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.name}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(user.role)}>
                                {getRoleIcon(user.role)}
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.grades && user.grades.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {user.grades.slice(0, 2).map((grade) => (
                                    <Badge key={grade} variant="outline" className="text-xs flex items-center gap-1">
                                      <School className="h-3 w-3" />
                                      {grade}
                                    </Badge>
                                  ))}
                                  {user.grades.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{user.grades.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.subjects && user.subjects.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {user.subjects.slice(0, 2).map((subject) => (
                                    <Badge key={subject} variant="secondary" className="text-xs">
                                      {subject}
                                    </Badge>
                                  ))}
                                  {user.subjects.length > 2 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{user.subjects.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.emailVerified ? "default" : "secondary"}>
                                {user.emailVerified ? "Verified" : "Unverified"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(user.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openViewDialog(user)}
                                  className="cursor-pointer"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(user)}
                                  className="cursor-pointer"
                                  >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Subjects</CardTitle>
                  <CardDescription>
                    Create and manage subjects that can be assigned to users
                  </CardDescription>
                </div>
                <Button onClick={() => setCreateSubjectDialogOpen(true)} className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subject
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSubjectsGrades ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableSubjects.map((subject) => (
                    <Card key={subject.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{subject.name}</h3>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSubject(subject.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Grades</CardTitle>
                  <CardDescription>
                    Create and manage grades that can be assigned to users
                  </CardDescription>
                </div>
                <Button onClick={() => setCreateGradeDialogOpen(true)} className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Grade
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSubjectsGrades ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableGrades
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((grade) => (
                    <Card key={grade.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{grade.name}</h3>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditGradeDialog(grade)}
                              className="cursor-pointer"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteGrade(grade.id)}
                              className="text-destructive hover:text-destructive cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Role Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.roleStats || {}).map(([role, count]) => (
                  <div key={role} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(role)}
                      <span className="capitalize">{role}</span>
                    </div>
                    <Badge variant={getRoleBadgeVariant(role)}>{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Verification Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Verified</span>
                  <Badge variant="default">{stats.verifiedUsers || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Unverified</span>
                  <Badge variant="secondary">{stats.unverifiedUsers || 0}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] sm:max-w-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={createForm.role} onValueChange={(value) => setCreateForm(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grades and Subjects - Only show for students and teachers */}
            {(createForm.role === "student" || createForm.role === "teacher") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="grades">Grades</Label>
                  {loadingSubjectsGrades ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Loading grades...</span>
                    </div>
                  ) : availableGrades.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                      {availableGrades
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((g) => (
                        <div key={g.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`create-grade-${g.id}`}
                            checked={createForm.grades.includes(g.name)}
                            onCheckedChange={() => handleGradeToggle(g.name, "create")}
                          />
                          <label
                            htmlFor={`create-grade-${g.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {g.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                      <p className="text-sm text-muted-foreground">No grades available</p>
                      <p className="text-xs text-muted-foreground mt-1">Create grades first</p>
                    </div>
                  )}
                </div>

                {/* Only show subjects for teachers, not students */}
                {createForm.role === "teacher" && (
                  <div className="space-y-2">
                    <Label htmlFor="subjects">Subjects</Label>
                    {loadingSubjectsGrades ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Loading subjects...</span>
                      </div>
                    ) : availableSubjects.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                        {availableSubjects.map((sub) => (
                          <div key={sub.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`create-subject-${sub.id}`}
                              checked={createForm.subjects.includes(sub.name)}
                              onCheckedChange={() => handleSubjectToggle(sub.name, "create")}
                            />
                            <label
                              htmlFor={`create-subject-${sub.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {sub.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                        <p className="text-sm text-muted-foreground">No subjects available</p>
                        <p className="text-xs text-muted-foreground mt-1">Create subjects first</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] sm:max-w-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={editForm.role} onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="emailVerified"
                checked={editForm.emailVerified}
                onChange={(e) => setEditForm(prev => ({ ...prev, emailVerified: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="emailVerified" className="text-sm font-medium">
                Email Verified
              </label>
            </div>

            {/* Grades and Subjects - Only show for students and teachers */}
            {(editForm.role === "student" || editForm.role === "teacher") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="grades">Grades</Label>
                  {loadingSubjectsGrades ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Loading grades...</span>
                    </div>
                  ) : availableGrades.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                      {availableGrades
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((g) => (
                        <div key={g.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-grade-${g.id}`}
                            checked={editForm.grades.includes(g.name)}
                            onCheckedChange={() => handleGradeToggle(g.name, "edit")}
                          />
                          <label
                            htmlFor={`edit-grade-${g.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {g.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                      <p className="text-sm text-muted-foreground">No grades available</p>
                      <p className="text-xs text-muted-foreground mt-1">Create grades first</p>
                    </div>
                  )}
                </div>

                {/* Only show subjects for teachers, not students */}
                {editForm.role === "teacher" && (
                  <div className="space-y-2">
                    <Label htmlFor="subjects">Subjects</Label>
                    {loadingSubjectsGrades ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Loading subjects...</span>
                      </div>
                    ) : availableSubjects.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                        {availableSubjects.map((sub) => (
                          <div key={sub.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-subject-${sub.id}`}
                              checked={editForm.subjects.includes(sub.name)}
                              onCheckedChange={() => handleSubjectToggle(sub.name, "edit")}
                            />
                            <label
                              htmlFor={`edit-subject-${sub.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {sub.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                        <p className="text-sm text-muted-foreground">No subjects available</p>
                        <p className="text-xs text-muted-foreground mt-1">Create subjects first</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View detailed user information
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm">{selectedUser.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <div>
                    <Badge variant={getRoleBadgeVariant(selectedUser.role)}>
                      {getRoleIcon(selectedUser.role)}
                      {selectedUser.role}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div>
                    <Badge variant={selectedUser.emailVerified ? "default" : "secondary"}>
                      {selectedUser.emailVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                </div>
                {(selectedUser.role === "student" || selectedUser.role === "teacher") && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Grades</label>
                      <div>
                        {selectedUser.grades && selectedUser.grades.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {selectedUser.grades.map((g) => (
                              <Badge key={g} variant="outline" className="text-xs flex items-center gap-1">
                                <School className="h-3 w-3" />
                                {g}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Subjects</label>
                      <div>
                        {selectedUser.subjects && selectedUser.subjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {selectedUser.subjects.map((sub) => (
                              <Badge key={sub} variant="secondary" className="text-xs">
                                {sub}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <p className="text-sm">
                <strong>Name:</strong> {selectedUser.name}
              </p>
              <p className="text-sm">
                <strong>Email:</strong> {selectedUser.email}
              </p>
              <p className="text-sm">
                <strong>Role:</strong> {selectedUser.role}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Subject Dialog (without description) */}
      <Dialog open={createSubjectDialogOpen} onOpenChange={setCreateSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Subject</DialogTitle>
            <DialogDescription>
              Add a new subject to the system
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubject} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject Name *</label>
              <Input
                value={createSubjectForm.name}
                onChange={(e) => setCreateSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Mathematics, Science, History"
                required
                className="w-full mt-2"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateSubjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Subject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Grade Dialog */}
      <Dialog open={createGradeDialogOpen} onOpenChange={setCreateGradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Grade</DialogTitle>
            <DialogDescription>
              Add a new grade to the system
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGrade} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Grade Number *</label>
              <Input
                value={createGradeForm.grade_number}
                onChange={(e) => setCreateGradeForm(prev => ({ ...prev, grade_number: e.target.value }))}
                placeholder="e.g., Grade 11(Science), Grade 1, Kindergarten"
                required
                className="w-full mt-2"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateGradeDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Grade</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Grade Dialog */}
      <Dialog open={editGradeDialogOpen} onOpenChange={setEditGradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Grade</DialogTitle>
            <DialogDescription>
              Update grade information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditGrade} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Grade Number *</label>
              <Input
                value={editGradeForm.grade_number}
                onChange={(e) => setEditGradeForm(prev => ({ ...prev, grade_number: e.target.value }))}
                placeholder="e.g., Grade 11(Science), Grade 1, Kindergarten"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditGradeDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Grade</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
