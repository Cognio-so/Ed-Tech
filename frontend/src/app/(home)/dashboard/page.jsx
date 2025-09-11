import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getServerSession } from "@/lib/get-session";

export const metadata = {
    title: "Student Dashboard",
    description: "Student Dashboard",
}

export default async function DashboardPage() {
    const session = await getServerSession();
    const user = session?.user; 
    
    return (
        <div className="flex flex-col p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Student Dashboard</CardTitle>
                    <CardDescription>
                        Welcome to your dashboard <span className="font-bold text-xl">{user?.name}</span>
                        <br />
                        Role: <span className="font-semibold">{user?.role}</span>
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}