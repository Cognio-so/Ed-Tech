"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  BookOpen, 
  GraduationCap, 
  FileText,
  Download,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Import server actions
import { 
  getCurriculum, 
  getCurriculumById, 
  createCurriculum, 
  updateCurriculum, 
  deleteCurriculum, 
  getCurriculumStats,
  getUniqueGrades,
  getUniqueSubjects
} from "./action";

export default function CurriculumManagementPage() {
  const [curriculum, setCurriculum] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [uniqueGrades, setUniqueGrades] = useState([]);
  const [uniqueSubjects, setUniqueSubjects] = useState([]);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    curriculum_name: "",
    subject: "",
    grade: "",
    ocrfile_id: "",
    url: "",
    file_id: ""
  });
  const [editForm, setEditForm] = useState({
    curriculum_name: "",
    subject: "",
    grade: "",
    ocrfile_id: "",
    url: "",
    file_id: ""
  });

  const limit = 10;

  // Memoized filtered data for performance
  const filteredCurriculum = useMemo(() => {
    return curriculum.filter(item => {
      const matchesSearch = !searchTerm || 
        item.curriculum_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.grade.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesGrade = gradeFilter === "all" || item.grade === gradeFilter;
      const matchesSubject = subjectFilter === "all" || item.subject === subjectFilter;
      
      return matchesSearch && matchesGrade && matchesSubject;
    });
  }, [curriculum, searchTerm, gradeFilter, subjectFilter]);

  // Fetch curriculum and stats with useCallback for performance
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [curriculumData, statsData, gradesData, subjectsData] = await Promise.all([
        getCurriculum(currentPage, limit, searchTerm, gradeFilter === "all" ? "" : gradeFilter, subjectFilter === "all" ? "" : subjectFilter),
        getCurriculumStats(),
        getUniqueGrades(),
        getUniqueSubjects()
      ]);
      
      setCurriculum(curriculumData.curriculum);
      setTotalPages(curriculumData.totalPages);
      setStats(statsData);
      setUniqueGrades(gradesData);
      setUniqueSubjects(subjectsData);
    } catch (error) {
      toast.error("Failed to fetch data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, gradeFilter, subjectFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle create curriculum
  const handleCreateCurriculum = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("curriculum_name", createForm.curriculum_name);
      formData.append("subject", createForm.subject);
      formData.append("grade", createForm.grade);
      formData.append("ocrfile_id", createForm.ocrfile_id);
      formData.append("url", createForm.url);
      formData.append("file_id", createForm.file_id);

      const result = await createCurriculum(formData);
      
      if (result.success) {
        toast.success(result.message);
        setCreateDialogOpen(false);
        setCreateForm({ curriculum_name: "", subject: "", grade: "", ocrfile_id: "", url: "", file_id: "" });
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to create curriculum");
    }
  };

  // Handle update curriculum
  const handleUpdateCurriculum = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("curriculum_name", editForm.curriculum_name);
      formData.append("subject", editForm.subject);
      formData.append("grade", editForm.grade);
      formData.append("ocrfile_id", editForm.ocrfile_id);
      formData.append("url", editForm.url);
      formData.append("file_id", editForm.file_id);

      const result = await updateCurriculum(selectedCurriculum.id, formData);
      
      if (result.success) {
        toast.success(result.message);
        setEditDialogOpen(false);
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to update curriculum");
    }
  };

  // Handle delete curriculum
  const handleDeleteCurriculum = async () => {
    try {
      const result = await deleteCurriculum(selectedCurriculum.id);
      
      if (result.success) {
        toast.success(result.message);
        setDeleteDialogOpen(false);
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to delete curriculum");
    }
  };

  // Open edit dialog
  const openEditDialog = async (curriculumItem) => {
    try {
      const curriculumData = await getCurriculumById(curriculumItem.id);
      setSelectedCurriculum(curriculumData);
      setEditForm({
        curriculum_name: curriculumData.curriculum_name,
        subject: curriculumData.subject,
        grade: curriculumData.grade,
        ocrfile_id: curriculumData.ocrfile_id,
        url: curriculumData.url,
        file_id: curriculumData.file_id
      });
      setEditDialogOpen(true);
    } catch (error) {
      toast.error("Failed to load curriculum data");
    }
  };

  // Open view dialog
  const openViewDialog = async (curriculumItem) => {
    try {
      const curriculumData = await getCurriculumById(curriculumItem.id);
      setSelectedCurriculum(curriculumData);
      setViewDialogOpen(true);
    } catch (error) {
      toast.error("Failed to load curriculum data");
    }
  };

  // Get grade badge variant
  const getGradeBadgeVariant = (grade) => {
    const gradeNumber = parseInt(grade.replace(/\D/g, ''));
    if (gradeNumber <= 3) return "secondary";
    if (gradeNumber <= 6) return "default";
    if (gradeNumber <= 9) return "outline";
    return "destructive";
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[80px]" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Curriculum Management</h1>
          <p className="text-muted-foreground">Manage curriculum, subjects, and educational content</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Add Curriculum
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Curriculum</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCurriculum || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Grades</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.gradeStats || {}).length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Subjects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.subjectStats || {}).length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Files</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {curriculum.filter(item => item.file_id || item.url).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="curriculum" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="curriculum">Curriculum List</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="curriculum" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search curriculum..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {uniqueGrades.map((grade) => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {uniqueSubjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Curriculum Table */}
          <Card>
            <CardHeader>
              <CardTitle>Curriculum</CardTitle>
              <CardDescription>
                Manage all curriculum in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingSkeleton />
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Curriculum Name</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Files</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCurriculum.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.curriculum_name}
                            </TableCell>
                            <TableCell>{item.subject}</TableCell>
                            <TableCell>
                              <Badge variant={getGradeBadgeVariant(item.grade)}>
                                {item.grade}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {item.file_id && (
                                  <Badge variant="outline" className="text-xs">
                                    <FileText className="h-3 w-3 mr-1" />
                                    File
                                  </Badge>
                                )}
                                {item.url && (
                                  <Badge variant="outline" className="text-xs">
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    URL
                                  </Badge>
                                )}
                                {!item.file_id && !item.url && (
                                  <Badge variant="secondary" className="text-xs">
                                    No Files
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {new Date(item.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openViewDialog(item)}
                                  className="cursor-pointer"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(item)}
                                  className="cursor-pointer"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCurriculum(item);
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

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Grade Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.gradeStats || {}).map(([grade, count]) => (
                  <div key={grade} className="flex justify-between items-center">
                    <span>{grade}</span>
                    <Badge variant={getGradeBadgeVariant(grade)}>{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Subject Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.subjectStats || {}).map(([subject, count]) => (
                  <div key={subject} className="flex justify-between items-center">
                    <span className="truncate">{subject}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Curriculum Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] sm:max-w-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Curriculum</DialogTitle>
            <DialogDescription>
              Add a new curriculum to the system
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCurriculum} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Curriculum Name *</label>
                <Input
                  value={createForm.curriculum_name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, curriculum_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <Select value={createForm.subject} onValueChange={(value) => setCreateForm(prev => ({ ...prev, subject: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueSubjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Grade *</label>
              <Select value={createForm.grade} onValueChange={(value) => setCreateForm(prev => ({ ...prev, grade: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a grade" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueGrades.map((grade) => (
                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">OCR File ID</label>
              <Input
                value={createForm.ocrfile_id}
                onChange={(e) => setCreateForm(prev => ({ ...prev, ocrfile_id: e.target.value }))}
                placeholder="OCR file identifier"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">File URL</label>
              <Input
                value={createForm.url}
                onChange={(e) => setCreateForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/file.pdf"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">File ID</label>
              <Input
                value={createForm.file_id}
                onChange={(e) => setCreateForm(prev => ({ ...prev, file_id: e.target.value }))}
                placeholder="File identifier"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Curriculum</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Curriculum Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] sm:max-w-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Curriculum</DialogTitle>
            <DialogDescription>
              Update curriculum information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCurriculum} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Curriculum Name *</label>
                <Input
                  value={editForm.curriculum_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, curriculum_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <Select value={editForm.subject} onValueChange={(value) => setEditForm(prev => ({ ...prev, subject: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueSubjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Grade *</label>
              <Select value={editForm.grade} onValueChange={(value) => setEditForm(prev => ({ ...prev, grade: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a grade" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueGrades.map((grade) => (
                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">OCR File ID</label>
              <Input
                value={editForm.ocrfile_id}
                onChange={(e) => setEditForm(prev => ({ ...prev, ocrfile_id: e.target.value }))}
                placeholder="OCR file identifier"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">File URL</label>
              <Input
                value={editForm.url}
                onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/file.pdf"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">File ID</label>
              <Input
                value={editForm.file_id}
                onChange={(e) => setEditForm(prev => ({ ...prev, file_id: e.target.value }))}
                placeholder="File identifier"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Curriculum</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Curriculum Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Curriculum Details</DialogTitle>
            <DialogDescription>
              View detailed curriculum information
            </DialogDescription>
          </DialogHeader>
          {selectedCurriculum && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Curriculum Name</label>
                  <p className="text-sm">{selectedCurriculum.curriculum_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subject</label>
                  <p className="text-sm">{selectedCurriculum.subject}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Grade</label>
                  <div>
                    <Badge variant={getGradeBadgeVariant(selectedCurriculum.grade)}>
                      {selectedCurriculum.grade}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">{new Date(selectedCurriculum.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {selectedCurriculum.ocrfile_id && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">OCR File ID</label>
                  <p className="text-sm break-all">{selectedCurriculum.ocrfile_id}</p>
                </div>
              )}
              {selectedCurriculum.url && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">File URL</label>
                  <a 
                    href={selectedCurriculum.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {selectedCurriculum.url}
                  </a>
                </div>
              )}
              {selectedCurriculum.file_id && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">File ID</label>
                  <p className="text-sm break-all">{selectedCurriculum.file_id}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Curriculum Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] sm:max-w-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete Curriculum</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this curriculum? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedCurriculum && (
            <div className="py-4">
              <p className="text-sm">
                <strong>Name:</strong> {selectedCurriculum.curriculum_name}
              </p>
              <p className="text-sm">
                <strong>Subject:</strong> {selectedCurriculum.subject}
              </p>
              <p className="text-sm">
                <strong>Grade:</strong> {selectedCurriculum.grade}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCurriculum}>
              Delete Curriculum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
