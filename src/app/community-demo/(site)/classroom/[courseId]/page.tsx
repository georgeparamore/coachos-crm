import { CoursePlayer } from "@/components/community-demo/course-player";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CoursePlayer courseId={courseId} />;
}
