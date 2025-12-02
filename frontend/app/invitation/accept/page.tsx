"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import {
  acceptInvitation,
  rejectInvitation,
  getInvitationByToken,
} from "@/app/invitation/action";
import { toast } from "sonner";

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (token) {
      loadInvitation();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;
    try {
      const result = await getInvitationByToken(token);
      if (result.success && result.invitation) {
        setInvitation(result.invitation);
      } else {
        toast.error(result.error || "Invalid or expired invitation");
      }
    } catch (error) {
      toast.error("Failed to load invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (!token) return;
    startTransition(async () => {
      try {
        const result = await acceptInvitation(token);
        if (result.success) {
          toast.success("Invitation accepted! Redirecting to login...");
          setTimeout(() => {
            router.push("/login");
          }, 1500);
        } else {
          toast.error(result.error || "Failed to accept invitation");
        }
      } catch (error) {
        toast.error("Failed to accept invitation");
      }
    });
  };

  const handleReject = () => {
    if (!token) return;
    startTransition(async () => {
      try {
        const result = await rejectInvitation(token);
        if (result.success) {
          toast.success("Invitation declined");
          setTimeout(() => {
            router.push("/invitation/rejected");
          }, 1000);
        } else {
          toast.error(result.error || "Failed to reject invitation");
        }
      } catch (error) {
        toast.error("Failed to reject invitation");
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!token || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Invalid Invitation
            </CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invitation.status === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              Invitation Already Accepted
            </CardTitle>
            <CardDescription>
              This invitation has already been accepted. You can log in to your
              account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.status === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Invitation Declined
            </CardTitle>
            <CardDescription>
              This invitation has been declined.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(invitation.expiresAt) < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Invitation Expired
            </CardTitle>
            <CardDescription>
              This invitation has expired. Please contact the administrator for
              a new invitation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription className="text-base">
            You have been invited to join our team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Name:
              </span>
              <span className="text-sm font-semibold">{invitation.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Email:
              </span>
              <span className="text-sm font-semibold">{invitation.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Role:
              </span>
              <span className="text-sm font-semibold capitalize">
                {invitation.role}
              </span>
            </div>
            {invitation.message && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Message:</p>
                <p className="text-sm italic">"{invitation.message}"</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleReject}
              variant="outline"
              disabled={isPending}
              className="flex-1"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Decline"
              )}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isPending}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
