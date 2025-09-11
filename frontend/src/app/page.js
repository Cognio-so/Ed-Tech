import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await authClient.getSession();
  const user = session?.user;

  if(!user) {
    redirect("/sign-in");
  }

  return (
    <div>
      <p>Welcome {user.name}</p>
    </div>
  );
}
