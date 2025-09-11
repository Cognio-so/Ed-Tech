import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";

export default async function Home() {

  const session = await authClient.getSession();
  const user  = session?.user;

  if(!user) {
    redirect("/sign-in");
  }

  return (
    <div>
      <p>Welcome {user.name}</p>
    </div>
  );
}
