"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { useCommunityDemo } from "@/lib/community-demo-store";
import type { DemoLesson } from "@/lib/community-demo-data";

export function CoursePlayer({ courseId }: { courseId: string }) {
  const { courses, completedLessonIds, toggleLessonComplete, courseProgress } = useCommunityDemo();
  const course = courses.find((c) => c.id === courseId);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(course?.lessons[0]?.id ?? null);

  const activeLesson: DemoLesson | undefined = useMemo(
    () => course?.lessons.find((l) => l.id === activeLessonId) ?? course?.lessons[0],
    [course, activeLessonId],
  );

  if (!course) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
          <div className="card-title">Course not found</div>
          <p className="page-sub">This course may have been removed by an admin.</p>
          <Link href="/community-demo/classroom" className="btn btn-primary" style={{ marginTop: 12 }}>
            Back to classroom
          </Link>
        </div>
      </div>
    );
  }

  const pct = courseProgress(course);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link href="/community-demo/classroom" className="mini-stat-label">
            ← Back to classroom
          </Link>
          <div className="page-title" style={{ marginTop: 4 }}>
            {course.title}
          </div>
          <div className="page-sub">{course.description}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mini-stat-value">{pct}% complete</div>
          <div className="cp-progress-track" style={{ width: 140 }}>
            <div className="cp-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="cp-player-layout">
        <div>
          {activeLesson ? (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="cp-video-frame">
                <iframe
                  key={activeLesson.id}
                  src={`https://www.youtube.com/embed/${activeLesson.youtubeId}`}
                  title={activeLesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div className="card-title-row">
                  <div className="card-title">{activeLesson.title}</div>
                  <button
                    className={`btn btn-sm${completedLessonIds.has(activeLesson.id) ? " btn-primary" : ""}`}
                    onClick={() => toggleLessonComplete(activeLesson.id)}
                  >
                    <NavIcon name="check-circle" />
                    {completedLessonIds.has(activeLesson.id) ? "Completed" : "Mark complete"}
                  </button>
                </div>
                <p className="page-sub">{activeLesson.durationMin} min lesson</p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
              <div className="card-title">No lessons yet</div>
              <p className="page-sub">Lessons uploaded from the admin panel will appear here.</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Lessons ({course.lessons.length})</div>
          {course.lessons.map((lesson, i) => {
            const done = completedLessonIds.has(lesson.id);
            const active = activeLesson?.id === lesson.id;
            return (
              <button
                key={lesson.id}
                className={`cp-lesson-row${active ? " cp-lesson-row-active" : ""}`}
                onClick={() => setActiveLessonId(lesson.id)}
              >
                <span className={`cp-lesson-check${done ? " cp-lesson-check-done" : ""}`}>
                  {done ? <NavIcon name="check" /> : i + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>{lesson.title}</span>
                <span className="mini-stat-label">{lesson.durationMin}m</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
