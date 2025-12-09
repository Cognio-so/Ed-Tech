"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, GraduationCap, BookOpen, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateStudentName } from "../action";
import type { StudentData } from "@/data/get-student";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

type FormValues = z.infer<typeof formSchema>;

interface SettingDataProps {
  studentData: StudentData;
}

export function SettingData({ studentData }: SettingDataProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: studentData.name || "",
    },
  });

  // Sync form with studentData when it changes
  React.useEffect(() => {
    form.reset({
      name: studentData.name || "",
    });
  }, [studentData.name, form]);

  const onSubmit = async (values: FormValues) => {
    if (values.name === studentData.name) {
      toast.info("No changes to save");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateStudentName(values.name);
      toast.success("Name updated successfully");
      router.refresh(); // Refresh server component to get updated data
    } catch (error) {
      toast.error("Failed to update name");
      console.error("Error updating name:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      {/* Profile Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Profile Information</CardTitle>
          <CardDescription>
            View and manage your profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Image and Basic Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage
                src={studentData.image || undefined}
                alt={studentData.name}
              />
              <AvatarFallback className="text-2xl">
                {getInitials(studentData.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-semibold">{studentData.name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{studentData.email}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Role */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Role
            </Label>
            <div>
              <Badge variant="secondary" className="text-sm">
                Student
              </Badge>
            </div>
          </div>

          {/* Grade */}
          {studentData.grade && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Grade
              </Label>
              <div>
                <Badge variant="outline">{studentData.grade.name}</Badge>
              </div>
            </div>
          )}

          {/* Subjects */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Subjects
            </Label>
            <div className="flex flex-wrap gap-2">
              {studentData.subjects && studentData.subjects.length > 0 ? (
                studentData.subjects.map((subject) => (
                  <Badge key={subject.id} variant="outline">
                    {subject.name}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No subjects assigned</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Information</CardTitle>
          <CardDescription>
            Update your profile information. Only your name can be changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Name Field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      Your display name that will be shown to teachers and classmates.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email Field (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={studentData.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-sm text-muted-foreground">
                  Email address cannot be changed. Contact your administrator if you need to update it.
                </p>
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

