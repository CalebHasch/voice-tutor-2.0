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
    <div className="min-h-screen flex flex-col items-center bg-stone-50 px-4 py-12">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');

        .font-display { font-family: 'Lora', serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }

        .course-card {
          transition: all 0.2s ease;
          border: 1.5px solid #e5e0d8;
          background: #fffefb;
        }

        .course-card:hover {
          border-color: #c2784a;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(194,120,74,0.12);
        }
      `}</style>

      <div className="w-full max-w-5xl space-y-8 font-body">
        <div className="text-center space-y-3">
          <h1 className="font-display text-4xl text-stone-800">
            Select a course
          </h1>

          <p className="text-stone-400 text-sm">
            Choose a course to begin learning
          </p>
        </div>

        <div
          className={`
            grid gap-4
            ${
              courses.length === 1
                ? "grid-cols-1 max-w-xl mx-auto"
                : "grid-cols-1 md:grid-cols-2"
            }
          `}
        >
          {" "}
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => onSelect(course)}
              className="course-card rounded-2xl px-6 py-5 text-left"
            >
              <div className="font-display text-lg text-stone-800">
                {course.title}
              </div>

              {course.course_code && (
                <div className="text-stone-400 text-sm mt-1">
                  {course.course_code}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
