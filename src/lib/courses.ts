export const COURSE_STATUSES = [
  { key: "draft", label: "Draft", badge: "badge-amber" },
  { key: "published", label: "Published", badge: "badge-green" },
  { key: "archived", label: "Archived", badge: "badge-blue" },
] as const;

export type CourseStatus = (typeof COURSE_STATUSES)[number]["key"];

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = Object.fromEntries(
  COURSE_STATUSES.map((s) => [s.key, s.label]),
) as Record<CourseStatus, string>;

export const COURSE_STATUS_BADGE: Record<CourseStatus, string> = Object.fromEntries(
  COURSE_STATUSES.map((s) => [s.key, s.badge]),
) as Record<CourseStatus, string>;

export type Course = {
  id: string;
  coach_id: string;
  business_id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseInput = {
  business_id: string;
  title: string;
  description: string;
  status: CourseStatus;
};

export type CourseModule = {
  id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  position: number;
  external_video_url: string | null;
  video_status: "processing" | "ready" | "failed";
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type LessonInput = {
  title: string;
  description: string;
  external_video_url: string;
};
