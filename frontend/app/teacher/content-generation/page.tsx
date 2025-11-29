import { ContentTabs } from "./_components/content-tabs";

export default function ContentGenerationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content Generation</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage educational content for your students
        </p>
      </div>
      <ContentTabs />
    </div>
  );
}