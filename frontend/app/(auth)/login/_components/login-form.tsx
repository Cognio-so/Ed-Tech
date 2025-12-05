"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Github, Loader2 } from "lucide-react";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isGithubPending, startGithubTransition] = useTransition();

  async function signInWithGoogle() {
    startGoogleTransition(async () => {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed in successfully, redirecting...");
          },
          onError: () => {
            toast.error("Internal server error");
          },
        },
      });
    });
  }

  async function signInWithGithub() {
    startGithubTransition(async () => {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed in successfully, redirecting...");
          },
          onError: () => {
            toast.error("Internal server error");
          },
        },
      });
    });
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full flex items-center gap-2 cursor-pointer"
                disabled={isGooglePending}
                onClick={signInWithGoogle}
              >
                {isGooglePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in ...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="w-5 h-5"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.94 0 6.62 1.71 8.14 3.14l5.93-5.93C34.23 3.82 29.5 2 24 2 14.62 2 6.7 7.48 3.14 15.02l6.91 5.36C11.57 14.12 17.24 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.5 24c0-1.57-.14-3.08-.41-4.5H24v9h12.65c-.55 2.96-2.19 5.48-4.65 7.18l7.19 5.58C43.62 37.1 46.5 31 46.5 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.05 28.64c-0.47-1.41-0.73-2.92-0.73-4.64s0.26-3.23 0.73-4.64l-6.91-5.36C1.79 16.3 1 19.06 1 24s0.79 7.7 2.14 9.99l6.91-5.35z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 47c6.5 0 11.95-2.15 15.93-5.84l-7.19-5.58c-2.03 1.36-4.63 2.17-7.74 2.17-6.76 0-12.43-4.62-14.41-10.88l-6.91 5.35C6.7 40.52 14.62 47 24 47z"
                      />
                    </svg>
                    Login with Google
                  </>
                )}
              </Button>
              <Button
                type="submit"
                variant="outline"
                className="w-full flex items-center gap-2 cursor-pointer"
                disabled={isGithubPending}
                onClick={signInWithGithub}
              >
                {isGithubPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in ...
                  </>
                ) : (
                  <>
                    <Github className="mr-2 h-4 w-4 text-blue-500" />
                    Login with Github
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
