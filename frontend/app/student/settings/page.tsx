import { getStudentData } from "@/data/get-student";
import { SettingData } from "./_components/setting-data";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const studentData = await getStudentData();

  if (!studentData) {
    redirect("/login");
  }

  return <SettingData studentData={studentData} />;
}

