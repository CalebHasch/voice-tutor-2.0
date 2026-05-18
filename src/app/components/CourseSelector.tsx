"use client";

import { CanvasCourse } from "@/app/types/canvas";

interface CourseSelectorProps {
  courses: CanvasCourse[];
  loading: boolean;
  onSelect: (course: CanvasCourse) => void;
}

export default function CourseSelector({
  courses,
  loading,
  onSelect,
}: CourseSelectorProps) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        Loading courses...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif text-stone-800">
            Select a course
          </h1>
        </div>

        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => onSelect(course)}
            className="w-full rounded-2xl border border-stone-200 bg-white p-6 text-left hover:border-amber-400 hover:shadow-md transition-all"
          >
            <div className="text-lg font-medium text-stone-800">
              {course.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
