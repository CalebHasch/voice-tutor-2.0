"use client";

import { CanvasCourse, CanvasModule } from "@/app/types/canvas";

interface ModuleSelectorProps {
  course: CanvasCourse;
  modules: CanvasModule[];
  loading: boolean;
  onSelect: (module: CanvasModule) => void;
  onBack: () => void;
}

export default function ModuleSelector({
  course,
  modules,
  loading,
  onSelect,
  onBack,
}: ModuleSelectorProps) {
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');

        .font-display { font-family: 'Lora', serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

        <div className="text-center space-y-4 font-body">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            {course.title}
          </p>

          <h1 className="font-display text-3xl text-stone-800">
            Loading modules...
          </h1>

          <div className="w-12 h-12 border-4 border-stone-200 border-t-[#c2784a] rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col items-center bg-stone-50 px-4 py-12">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');

        .font-display { font-family: 'Lora', serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }

        .module-card {
          transition: all 0.2s ease;
          border: 1.5px solid #e5e0d8;
          background: #fffefb;
        }

        .module-card:hover {
          border-color: #c2784a;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(194,120,74,0.12);
        }
      `}</style>

      <div className="w-full max-w-6xl space-y-8 font-body">
        <div className="text-center space-y-3">
          <button
            onClick={onBack}
            className="text-sm text-stone-400 hover:text-stone-600"
          >
            ← Back to courses
          </button>

          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            {course.title}
          </p>

          <h1 className="font-display text-4xl text-stone-800">
            Select a module
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => onSelect(module)}
              className="module-card rounded-2xl px-6 py-5 text-left"
            >
              <div className="font-display text-lg text-stone-800">
                {module.title}
              </div>

              <div className="text-stone-400 text-sm mt-1">
                {module.module_items?.length ?? 0} learning items
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
