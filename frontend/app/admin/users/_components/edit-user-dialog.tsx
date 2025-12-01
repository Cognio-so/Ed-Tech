"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserWithDetails } from "@/data/get-all-users";
import { toast } from "sonner";

interface EditUserDialogProps {
  user: UserWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  grades: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  userSubjects: string[];
  userGrades?: string[];
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
  grades,
  subjects,
  userSubjects: initialUserSubjects,
  userGrades: initialUserGrades = [],
}: EditUserDialogProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("");
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setSelectedSubjects(initialUserSubjects || []);
      setSelectedGrades(initialUserGrades || (user as any).gradeIds || []);
    }
  }, [user, initialUserSubjects, initialUserGrades]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("role", role);
      formData.append("gradeIds", JSON.stringify(selectedGrades));
      formData.append("subjectIds", JSON.stringify(selectedSubjects));

      const response = await fetch(`/api/user/${user.id}`, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      toast.success("User updated successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update user");
      console.error("Error updating user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const toggleGrade = (gradeId: string) => {
    setSelectedGrades((prev) =>
      prev.includes(gradeId)
        ? prev.filter((id) => id !== gradeId)
        : [...prev, gradeId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and assignments
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grades</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-3 gap-3">
                  {grades.map((grade) => (
                    <label
                      key={grade.id}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedGrades.includes(grade.id)}
                        onCheckedChange={() => toggleGrade(grade.id)}
                      />
                      <span className="text-sm">{grade.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subjects</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {subjects.map((subject) => (
                    <label
                      key={subject.id}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSubjects.includes(subject.id)}
                        onCheckedChange={() => toggleSubject(subject.id)}
                      />
                      <span className="text-sm">{subject.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

