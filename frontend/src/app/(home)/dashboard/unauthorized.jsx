"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";


export default function Unauthorized() {
    const router = useRouter();
    return (
        <div className="flex grow items-center justify-center px-4 text-center">
            <div className="space-y-6">
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold">Unauthorized</h1>
                    <p className="text-sm text-muted-foreground">Please sign in to continue</p>
                </div>
                <div className="space-y-2">
                    <Button variant="outline" onClick={() => router.push("/sign-in")}>Sign In</Button>
                </div>
            </div>
            
        </div>
    )
}
