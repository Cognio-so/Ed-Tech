"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserTable } from "./user-table";
import { UserFilters } from "./user-filters";
import type { UserWithDetails } from "@/data/get-all-users";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTableSkeleton } from "@/app/admin/_components/loading-skeletons";
import { EditUserDialog } from "./edit-user-dialog";
import { toast } from "sonner";

interface UsersPageClientProps {
  initialUsers: UserWithDetails[];
  grades: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
}

export function UsersPageClient({
  initialUsers,
  grades,
  subjects,
}: UsersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allUsers, setAllUsers] = React.useState(initialUsers);
  const [searchQuery, setSearchQuery] = React.useState(
    searchParams.get("search") || ""
  );
  const [roleFilter, setRoleFilter] = React.useState(
    searchParams.get("role") || "all"
  );
  const [previewUser, setPreviewUser] = React.useState<UserWithDetails | null>(
    null
  );
  const [editUser, setEditUser] = React.useState<UserWithDetails | null>(
    null
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Client-side filtering - no page reload
  const filteredUsers = React.useMemo(() => {
    let filtered = allUsers;

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allUsers, roleFilter, searchQuery]);

  // Update URL without reloading (for bookmarking/sharing)
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (roleFilter !== "all") params.set("role", roleFilter);
    
    const newUrl = `/admin/users?${params.toString()}`;
    if (window.location.search !== `?${params.toString()}`) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchQuery, roleFilter]);

  const handlePreview = (user: UserWithDetails) => {
    setPreviewUser(user);
  };

  const handleEdit = (user: UserWithDetails) => {
    setEditUser(user);
  };

  const handleEditSuccess = async () => {
    // Refetch users after edit
    const editResponse = await fetch("/api/user");
    if (editResponse.ok) {
      const data = await editResponse.json();
      setAllUsers(data);
    }
  };

  const handleDelete = async (user: UserWithDetails) => {
    if (!confirm(`Are you sure you want to delete ${user.name}?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/user/${user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      toast.success("User deleted successfully");
      setAllUsers(allUsers.filter((u) => u.id !== user.id));
      // Refetch to ensure consistency
      const deleteResponse = await fetch("/api/user");
      if (deleteResponse.ok) {
        const data = await deleteResponse.json();
        setAllUsers(data);
      }
    } catch (error) {
      toast.error("Failed to delete user");
      console.error("Error deleting user:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <UserFilters
          searchQuery={searchQuery}
          roleFilter={roleFilter}
          onSearchChange={setSearchQuery}
          onRoleFilterChange={setRoleFilter}
        />
        <UserTable
          users={filteredUsers}
          onPreview={handlePreview}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <Dialog open={!!previewUser} onOpenChange={() => setPreviewUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View user information and details
            </DialogDescription>
          </DialogHeader>
          {previewUser && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Name
                </label>
                <p className="text-sm">{previewUser.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <p className="text-sm">{previewUser.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Role
                </label>
                <p className="text-sm">{previewUser.role}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Grade
                </label>
                <p className="text-sm">{previewUser.grade || "Not assigned"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Subjects
                </label>
                <p className="text-sm">{previewUser.subjects || "Not assigned"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created At
                </label>
                <p className="text-sm">
                  {new Date(previewUser.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        onSuccess={handleEditSuccess}
        grades={grades}
        subjects={subjects}
        userSubjects={editUser?.subjectIds || []}
      />
    </>
  );
}

