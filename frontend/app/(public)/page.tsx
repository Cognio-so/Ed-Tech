import { redirect } from "next/navigation";
import { getUserSession } from "@/data/get-user-session";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getUserSession();

  if (session?.user) {
    const userRole = session.user.role;

    if (userRole === "admin") {
      redirect("/admin");
    } else if (userRole === "student") {
      redirect("/student");
    } else if(userRole === "teacher") {
      redirect("/teacher");
    } else {
      redirect("/login");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <h1 className="text-4xl font-bold">Hello World</h1>
      <Link href="/login" className={buttonVariants({
        variant: "default",
      })}>Login</Link>
    </div>
  );
}
