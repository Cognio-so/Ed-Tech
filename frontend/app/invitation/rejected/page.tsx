"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RejectedInvitationPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Thanks, See You Soon!</CardTitle>
          <CardDescription className="text-base">
            We respect your decision. If you change your mind, feel free to reach out to us.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            We appreciate you taking the time to consider our invitation. 
            You're always welcome to join us in the future!
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

