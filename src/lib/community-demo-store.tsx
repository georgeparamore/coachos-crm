"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  COURSES,
  EVENTS,
  LEADS,
  MEMBERS,
  POSTS,
  type DemoComment,
  type DemoCourse,
  type DemoEvent,
  type DemoLead,
  type DemoMember,
  type DemoPost,
  type LeadStatus,
} from "@/lib/community-demo-data";

export type ViewMode = "student" | "admin";

type NewEventInput = Omit<DemoEvent, "id">;
type NewCourseInput = { title: string; description: string; category: string; color: string };
type NewLessonInput = { title: string; durationMin: number; youtubeId: string };

const CURRENT_STUDENT_ID = "m1"; // "Sarah Chen" — the logged-in learner for this demo

type StoreValue = {
  view: ViewMode;
  setView: (v: ViewMode) => void;

  // Classroom / progress
  courses: DemoCourse[];
  completedLessonIds: Set<string>;
  toggleLessonComplete: (lessonId: string) => void;
  courseProgress: (course: DemoCourse) => number; // 0-100
  addCourse: (input: NewCourseInput) => DemoCourse;
  deleteCourse: (id: string) => void;
  addLesson: (courseId: string, input: NewLessonInput) => void;
  deleteLesson: (courseId: string, lessonId: string) => void;

  // Community
  members: DemoMember[];
  posts: DemoPost[];
  addPost: (content: string, category: DemoPost["category"]) => void;
  likePost: (postId: string) => void;
  addComment: (postId: string, content: string) => void;

  // Calendar
  events: DemoEvent[];
  addEvent: (event: NewEventInput) => void;
  updateEvent: (id: string, event: NewEventInput) => void;
  deleteEvent: (id: string) => void;

  // Leads (admin)
  leads: DemoLead[];
  updateLeadStatus: (id: string, status: LeadStatus) => void;
  emailedLeadIds: Set<string>;
  markLeadEmailed: (id: string) => void;
};

const CommunityDemoContext = createContext<StoreValue | null>(null);

export function CommunityDemoProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<ViewMode>("student");
  const [courses, setCourses] = useState<DemoCourse[]>(COURSES);
  const [members] = useState<DemoMember[]>(MEMBERS);
  const [posts, setPosts] = useState<DemoPost[]>(POSTS);
  const [events, setEvents] = useState<DemoEvent[]>(EVENTS);
  const [leads, setLeads] = useState<DemoLead[]>(LEADS);
  const [emailedLeadIds, setEmailedLeadIds] = useState<Set<string>>(new Set());

  // A handful of lessons are pre-completed so the classroom demo doesn't open empty.
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
    () => new Set(["c1-l1", "c1-l2", "c2-l1", "c2-l2", "c2-l3"]),
  );

  const toggleLessonComplete = useCallback((lessonId: string) => {
    setCompletedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  }, []);

  const courseProgress = useCallback(
    (course: DemoCourse) => {
      if (course.lessons.length === 0) return 0;
      const done = course.lessons.filter((l) => completedLessonIds.has(l.id)).length;
      return Math.round((done / course.lessons.length) * 100);
    },
    [completedLessonIds],
  );

  const addCourse = useCallback((input: NewCourseInput) => {
    const course: DemoCourse = { ...input, id: `course-${Date.now()}`, lessons: [] };
    setCourses((prev) => [...prev, course]);
    return course;
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addLesson = useCallback((courseId: string, input: NewLessonInput) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === courseId ? { ...c, lessons: [...c.lessons, { ...input, id: `lesson-${Date.now()}` }] } : c,
      ),
    );
  }, []);

  const deleteLesson = useCallback((courseId: string, lessonId: string) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) } : c)),
    );
  }, []);

  const addPost = useCallback((content: string, category: DemoPost["category"]) => {
    setPosts((prev) => [
      {
        id: `post-${Date.now()}`,
        authorId: CURRENT_STUDENT_ID,
        category,
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: [],
      },
      ...prev,
    ]);
  }, []);

  const likePost = useCallback((postId: string) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p)));
  }, []);

  const addComment = useCallback((postId: string, content: string) => {
    const comment: DemoComment = { id: `comment-${Date.now()}`, authorId: CURRENT_STUDENT_ID, content, createdAt: new Date().toISOString() };
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p)));
  }, []);

  const addEvent = useCallback((event: NewEventInput) => {
    setEvents((prev) => [...prev, { ...event, id: `event-${Date.now()}` }]);
  }, []);

  const updateEvent = useCallback((id: string, event: NewEventInput) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...event } : e)));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateLeadStatus = useCallback((id: string, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  }, []);

  const markLeadEmailed = useCallback((id: string) => {
    setEmailedLeadIds((prev) => new Set(prev).add(id));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      view,
      setView,
      courses,
      completedLessonIds,
      toggleLessonComplete,
      courseProgress,
      addCourse,
      deleteCourse,
      addLesson,
      deleteLesson,
      members,
      posts,
      addPost,
      likePost,
      addComment,
      events,
      addEvent,
      updateEvent,
      deleteEvent,
      leads,
      updateLeadStatus,
      emailedLeadIds,
      markLeadEmailed,
    }),
    [
      view,
      courses,
      completedLessonIds,
      toggleLessonComplete,
      courseProgress,
      addCourse,
      deleteCourse,
      addLesson,
      deleteLesson,
      members,
      posts,
      addPost,
      likePost,
      addComment,
      events,
      addEvent,
      updateEvent,
      deleteEvent,
      leads,
      updateLeadStatus,
      emailedLeadIds,
      markLeadEmailed,
    ],
  );

  return <CommunityDemoContext.Provider value={value}>{children}</CommunityDemoContext.Provider>;
}

export function useCommunityDemo() {
  const ctx = useContext(CommunityDemoContext);
  if (!ctx) throw new Error("useCommunityDemo must be used within CommunityDemoProvider");
  return ctx;
}

export { CURRENT_STUDENT_ID };
