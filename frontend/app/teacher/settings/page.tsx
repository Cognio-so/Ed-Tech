import { getTeacherData } from "@/data/get-teacher";
import { SettingData } from "./_components/setting-data";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const teacherData = await getTeacherData();

  if (!teacherData) {
    redirect("/login");
  }

  return <SettingData teacherData={teacherData} />;
}
