"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NavIcon } from "@/components/nav-icon";
import { CourseFormModal } from "@/components/course-form-modal";
import { LessonFormModal } from "@/components/lesson-form-modal";
import { useErrorToast } from "@/components/error-toast-provider";
import { COURSE_STATUS_LABEL, type Course, type CourseInput, type CourseModule, type Lesson, type LessonInput } from "@/lib/courses";

type LessonEditor = { courseId: string; moduleId: string; lesson: Lesson | null };
type DragItem = { type: "module"; courseId: string; moduleId: string } | { type: "lesson"; moduleId: string; lessonId: string };

export function CoursesBoard({ initialCourses, initialModulesByCourse, initialLessonsByModule, enrollmentCountByCourse, coachId, initialCreate }: {
  initialCourses: Course[];
  initialModulesByCourse: Record<string, CourseModule[]>;
  initialLessonsByModule: Record<string, Lesson[]>;
  enrollmentCountByCourse: Record<string, number>;
  coachId: string;
  initialCreate?: boolean;
}) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [courses, setCourses] = useState(initialCourses);
  const [modulesByCourse, setModulesByCourse] = useState(initialModulesByCourse);
  const [lessonsByModule, setLessonsByModule] = useState(initialLessonsByModule);
  const [expandedId, setExpandedId] = useState<string | null>(initialCourses[0]?.id ?? null);
  const [editingCourse, setEditingCourse] = useState<Course | null | undefined>(initialCreate ? null : undefined);
  const [lessonEditor, setLessonEditor] = useState<LessonEditor | null>(null);
  const [newModuleFor, setNewModuleFor] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => { if (initialCreate) router.replace("/courses"); }, [initialCreate, router]);

  const totals = useMemo(() => {
    const lessons = Object.values(lessonsByModule).reduce((sum, rows) => sum + rows.length, 0);
    const students = Object.values(enrollmentCountByCourse).reduce((sum, count) => sum + count, 0);
    return { lessons, students, published: courses.filter((course) => course.status === "published").length };
  }, [courses, enrollmentCountByCourse, lessonsByModule]);

  async function saveCourse(input: CourseInput) {
    const supabase = createClient();
    if (editingCourse) {
      const { data, error } = await supabase.from("courses").update(input).eq("id", editingCourse.id).select().single();
      if (error) throw error;
      setCourses((current) => current.map((course) => course.id === data.id ? data as Course : course));
    } else {
      const { data, error } = await supabase.from("courses").insert({ ...input, coach_id: coachId }).select().single();
      if (error) throw error;
      setCourses((current) => [data as Course, ...current]);
      setModulesByCourse((current) => ({ ...current, [data.id]: [] }));
      setExpandedId(data.id);
    }
    setEditingCourse(undefined);
    router.refresh();
  }

  async function deleteCourse() {
    if (!editingCourse) return;
    const { error } = await createClient().from("courses").delete().eq("id", editingCourse.id);
    if (error) throw error;
    setCourses((current) => current.filter((course) => course.id !== editingCourse.id));
    setEditingCourse(undefined);
    router.refresh();
  }

  async function addModule(courseId: string) {
    const title = moduleTitle.trim();
    if (!title) return;
    setWorking(`module-${courseId}`);
    try {
      const currentModules = modulesByCourse[courseId] ?? [];
      const { data, error } = await createClient().from("course_modules").insert({ course_id: courseId, title, position: currentModules.length }).select().single();
      if (error) throw error;
      setModulesByCourse((current) => ({ ...current, [courseId]: [...(current[courseId] ?? []), data as CourseModule] }));
      setLessonsByModule((current) => ({ ...current, [data.id]: [] }));
      setModuleTitle("");
      setNewModuleFor(null);
      router.refresh();
    } catch (error) { showError(error, "courses.module-save"); } finally { setWorking(null); }
  }

  async function saveLesson(input: LessonInput) {
    if (!lessonEditor) return;
    const { courseId, moduleId, lesson } = lessonEditor;
    const supabase = createClient();
    if (lesson) {
      const { data, error } = await supabase.from("lessons").update({ title: input.title, description: input.description || null, external_video_url: input.external_video_url || null, video_status: "ready" }).eq("id", lesson.id).select().single();
      if (error) throw error;
      setLessonsByModule((current) => ({ ...current, [moduleId]: (current[moduleId] ?? []).map((row) => row.id === lesson.id ? data as Lesson : row) }));
    } else {
      const rows = lessonsByModule[moduleId] ?? [];
      const { data, error } = await supabase.from("lessons").insert({ module_id: moduleId, title: input.title, description: input.description || null, external_video_url: input.external_video_url || null, video_status: "ready", position: rows.length }).select().single();
      if (error) throw error;
      setLessonsByModule((current) => ({ ...current, [moduleId]: [...(current[moduleId] ?? []), data as Lesson] }));
    }
    setLessonEditor(null);
    setExpandedId(courseId);
    router.refresh();
  }

  async function deleteLesson(moduleId: string, lessonId: string) {
    setWorking(lessonId);
    try {
      const { error } = await createClient().from("lessons").delete().eq("id", lessonId);
      if (error) throw error;
      setLessonsByModule((current) => ({ ...current, [moduleId]: (current[moduleId] ?? []).filter((lesson) => lesson.id !== lessonId) }));
      router.refresh();
    } catch (error) { showError(error, "courses.lesson-delete"); } finally { setWorking(null); }
  }

  async function moveLesson(moduleId: string, index: number, direction: -1 | 1) {
    const rows = [...(lessonsByModule[moduleId] ?? [])];
    const target = index + direction;
    if (!rows[index] || !rows[target]) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    const positioned = rows.map((lesson, position) => ({ ...lesson, position }));
    setLessonsByModule((current) => ({ ...current, [moduleId]: positioned }));
    const supabase = createClient();
    const results = await Promise.all(positioned.map((lesson) => supabase.from("lessons").update({ position: lesson.position }).eq("id", lesson.id)));
    const failed = results.find((result) => result.error);
    if (failed?.error) showError(failed.error, "courses.lesson-reorder");
    router.refresh();
  }

  async function persistModules(courseId: string, rows: CourseModule[]) {
    const positioned = rows.map((module, position) => ({ ...module, position }));
    setModulesByCourse((current) => ({ ...current, [courseId]: positioned }));
    const supabase = createClient();
    const results = await Promise.all(positioned.map((module) => supabase.from("course_modules").update({ position: module.position }).eq("id", module.id)));
    const failed = results.find((result) => result.error);
    if (failed?.error) showError(failed.error, "courses.module-reorder");
  }

  async function moveModule(courseId: string, index: number, direction: -1 | 1) {
    const rows = [...(modulesByCourse[courseId] ?? [])];
    const target = index + direction;
    if (!rows[index] || !rows[target]) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    await persistModules(courseId, rows);
    router.refresh();
  }

  async function dropModule(courseId: string, targetModuleId: string) {
    if (dragItem?.type !== "module" || dragItem.courseId !== courseId || dragItem.moduleId === targetModuleId) return;
    const rows = [...(modulesByCourse[courseId] ?? [])];
    const sourceIndex = rows.findIndex((module) => module.id === dragItem.moduleId);
    const targetIndex = rows.findIndex((module) => module.id === targetModuleId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = rows.splice(sourceIndex, 1);
    if (!moved) return;
    rows.splice(targetIndex, 0, moved);
    setDragItem(null); setDropTarget(null);
    await persistModules(courseId, rows);
    router.refresh();
  }

  async function dropLesson(targetModuleId: string, targetIndex: number) {
    if (dragItem?.type !== "lesson") return;
    const sourceModuleId = dragItem.moduleId;
    const sourceRows = [...(lessonsByModule[sourceModuleId] ?? [])];
    const sourceIndex = sourceRows.findIndex((lesson) => lesson.id === dragItem.lessonId);
    if (sourceIndex < 0) return;
    const [moved] = sourceRows.splice(sourceIndex, 1);
    if (!moved) return;
    const targetRows = sourceModuleId === targetModuleId ? sourceRows : [...(lessonsByModule[targetModuleId] ?? [])];
    const adjustedIndex = sourceModuleId === targetModuleId && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    targetRows.splice(Math.max(0, Math.min(adjustedIndex, targetRows.length)), 0, { ...moved, module_id: targetModuleId });
    const sourcePositioned = sourceRows.map((lesson, position) => ({ ...lesson, position }));
    const targetPositioned = targetRows.map((lesson, position) => ({ ...lesson, position }));
    setLessonsByModule((current) => ({ ...current, [sourceModuleId]: sourceModuleId === targetModuleId ? targetPositioned : sourcePositioned, [targetModuleId]: targetPositioned }));
    setDragItem(null); setDropTarget(null);
    const rowsToSave = sourceModuleId === targetModuleId ? targetPositioned : [...sourcePositioned, ...targetPositioned];
    const supabase = createClient();
    const results = await Promise.all(rowsToSave.map((lesson) => supabase.from("lessons").update({ module_id: lesson.module_id, position: lesson.position }).eq("id", lesson.id)));
    const failed = results.find((result) => result.error);
    if (failed?.error) showError(failed.error, "courses.lesson-drag");
    router.refresh();
  }

  return <>
    <section className="programs-hero">
      <div><span className="eyebrow">Curriculum studio</span><h1>Programs</h1><p>Design the path, enroll your people, and see exactly where momentum slows down.</p></div>
      <button className="btn btn-accent" onClick={() => setEditingCourse(null)}><NavIcon name="plus" /> New program</button>
    </section>

    <div className="program-metrics"><div><strong>{courses.length}</strong><span>Programs</span></div><div><strong>{totals.lessons}</strong><span>Lessons</span></div><div><strong>{totals.students}</strong><span>Enrollments</span></div><div><strong>{totals.published}</strong><span>Published</span></div></div>

    {courses.length === 0 ? <div className="card program-empty"><NavIcon name="book-open" /><h2>Build your first program</h2><p>Create a clear sequence of sections and lessons your clients can follow at their own pace.</p><button className="btn btn-accent" onClick={() => setEditingCourse(null)}>Create program</button></div> : <div className="program-list">
      {courses.map((course) => {
        const modules = modulesByCourse[course.id] ?? [];
        const lessonCount = modules.reduce((sum, module) => sum + (lessonsByModule[module.id]?.length ?? 0), 0);
        const expanded = expandedId === course.id;
        return <article className={`card program-card${expanded ? " expanded" : ""}`} key={course.id}>
          <div className="program-card-head">
            <div className="program-index">{String(courses.indexOf(course) + 1).padStart(2, "0")}</div>
            <div className="program-card-copy"><div className="program-status"><span className={`program-status-dot ${course.status}`} />{COURSE_STATUS_LABEL[course.status]}</div><h2>{course.title}</h2><p>{course.description || "Add a short promise for this program."}</p><div className="program-meta"><span>{modules.length} sections</span><span>{lessonCount} lessons</span><span>{enrollmentCountByCourse[course.id] ?? 0} enrolled</span></div></div>
            <div className="program-card-actions"><button className="btn btn-sm" onClick={() => setEditingCourse(course)}>Settings</button><button className="btn btn-sm btn-primary" onClick={() => setExpandedId(expanded ? null : course.id)}>{expanded ? "Close builder" : "Open builder"}</button></div>
          </div>
          {expanded && <div className="program-builder">
            <div className="program-builder-title"><div><span className="eyebrow">Curriculum</span><h3>Program outline</h3></div><button className="btn btn-sm" onClick={() => { setNewModuleFor(course.id); setModuleTitle(""); }}><NavIcon name="plus" /> Add section</button></div>
            {newModuleFor === course.id && <div className="program-inline-form"><input autoFocus className="form-input" placeholder="Section title, e.g. Foundations" value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addModule(course.id); }} /><button className="btn btn-primary btn-sm" disabled={!moduleTitle.trim() || working !== null} onClick={() => addModule(course.id)}>Add</button><button className="btn btn-sm" onClick={() => setNewModuleFor(null)}>Cancel</button></div>}
            {modules.length === 0 && <div className="program-section-empty"><p>Add a section to begin organizing the client journey.</p></div>}
            {modules.map((module, moduleIndex) => { const lessons = lessonsByModule[module.id] ?? []; return <section className={`program-section${dropTarget === `module-${module.id}` ? " drag-over" : ""}${dragItem?.type === "module" && dragItem.moduleId === module.id ? " dragging" : ""}`} key={module.id} onDragOver={(event) => { if (dragItem?.type === "module") { event.preventDefault(); setDropTarget(`module-${module.id}`); } }} onDrop={() => dropModule(course.id, module.id)}>
              <header draggable onDragStart={(event) => { event.stopPropagation(); setDragItem({ type: "module", courseId: course.id, moduleId: module.id }); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragItem(null); setDropTarget(null); }}><span className="program-drag-handle" title="Drag section">⠿</span><span>{String(moduleIndex + 1).padStart(2, "0")}</span><div><h3>{module.title}</h3><p>{lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}</p></div><div className="program-section-actions"><button aria-label="Move section up" disabled={moduleIndex === 0} onClick={() => moveModule(course.id, moduleIndex, -1)}>↑</button><button aria-label="Move section down" disabled={moduleIndex === modules.length - 1} onClick={() => moveModule(course.id, moduleIndex, 1)}>↓</button><button className="btn btn-sm" onClick={() => setLessonEditor({ courseId: course.id, moduleId: module.id, lesson: null })}><NavIcon name="plus" /> Lesson</button></div></header>
              <div className={`program-lessons${dropTarget === `lesson-end-${module.id}` ? " drag-over" : ""}`} onDragOver={(event) => { if (dragItem?.type === "lesson") { event.preventDefault(); setDropTarget(`lesson-end-${module.id}`); } }} onDrop={(event) => { event.stopPropagation(); dropLesson(module.id, lessons.length); }}>{lessons.map((lesson, index) => <div className={`program-lesson${dropTarget === `lesson-${lesson.id}` ? " drag-over" : ""}${dragItem?.type === "lesson" && dragItem.lessonId === lesson.id ? " dragging" : ""}`} draggable key={lesson.id} onDragStart={(event) => { event.stopPropagation(); setDragItem({ type: "lesson", moduleId: module.id, lessonId: lesson.id }); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragItem(null); setDropTarget(null); }} onDragOver={(event) => { if (dragItem?.type === "lesson") { event.preventDefault(); event.stopPropagation(); setDropTarget(`lesson-${lesson.id}`); } }} onDrop={(event) => { event.stopPropagation(); dropLesson(module.id, index); }}><div className="program-drag-handle" title="Drag lesson">⠿</div><div className="program-lesson-number">{index + 1}</div><div className="program-lesson-icon"><NavIcon name={lesson.external_video_url ? "video" : "file-text"} /></div><div><strong>{lesson.title}</strong><span>{lesson.external_video_url ? "Video lesson" : "Reading / assignment"}{lesson.description ? ` · ${lesson.description}` : ""}</span></div><div className="program-lesson-actions"><button aria-label="Move lesson up" disabled={index === 0} onClick={() => moveLesson(module.id, index, -1)}>↑</button><button aria-label="Move lesson down" disabled={index === lessons.length - 1} onClick={() => moveLesson(module.id, index, 1)}>↓</button><button onClick={() => setLessonEditor({ courseId: course.id, moduleId: module.id, lesson })}>Edit</button><button disabled={working === lesson.id} onClick={() => deleteLesson(module.id, lesson.id)}>Remove</button></div></div>)}</div>
            </section>; })}
          </div>}
        </article>;
      })}
    </div>}

    {editingCourse !== undefined && <CourseFormModal course={editingCourse} onClose={() => setEditingCourse(undefined)} onSave={saveCourse} onDelete={editingCourse ? deleteCourse : undefined} />}
    {lessonEditor && <LessonFormModal lesson={lessonEditor.lesson} onClose={() => setLessonEditor(null)} onSave={saveLesson} />}
  </>;
}
