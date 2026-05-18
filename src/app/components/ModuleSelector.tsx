"use client";

import { CanvasCourse, CanvasModule } from "@/app/types/canvas";

interface ModuleSelectorProps {
  course: CanvasCourse;
  modules: CanvasModule[];
  onSelect: (module: CanvasModule) => void;
  onBack: () => void;
}

export default function ModuleSelector({
  course,
  modules,
  onSelect,
  onBack,
}: ModuleSelectorProps) {
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

      <div className="w-full max-w-3xl space-y-8 font-body">
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

        <div className="space-y-3">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => onSelect(module)}
              className="module-card w-full rounded-2xl px-6 py-5 text-left"
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
