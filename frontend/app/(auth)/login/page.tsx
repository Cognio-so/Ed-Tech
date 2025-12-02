import { redirect } from "next/navigation";
import { LoginForm } from "./_components/login-form";
import Link from "next/link";
import { getUserSession } from "@/data/get-user-session";

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getUserSession();

  if (session?.user) {
    const userRole = session.user.role;

    if (userRole === "admin") {
      redirect("/admin");
    } else if (userRole === "teacher") {
      redirect("/teacher");
    } else if (userRole === "student") {
      redirect("/student");
    }
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center text-xl font-bold"
        >
          {/* <Image src="/logo.svg" alt="logo" className="size-8" /> */}
           Welcome to Ed-Tech Platform
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}