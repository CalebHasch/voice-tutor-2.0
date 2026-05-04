"use client";

import { TOPICS } from "@/app/types/tutor";

interface TopicSelectorProps {
  onSelect: (topicId: string) => void;
}

export default function TopicSelector({ onSelect }: TopicSelectorProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .font-display { font-family: 'Lora', Georgia, serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        .topic-card {
          transition: all 0.2s ease;
          border: 1.5px solid #e5e0d8;
          background: #fffefb;
        }
        .topic-card:hover {
          border-color: #c2784a;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(194,120,74,0.12);
        }
      `}</style>

      <div className="w-full max-w-lg text-center space-y-10 font-body">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            AI Tutor
          </p>
          <h1 className="font-display text-4xl text-stone-800 leading-tight">
            What would you like
            <br />
            <em>to learn today?</em>
          </h1>
          <p className="text-stone-500 text-sm leading-relaxed">
            Select a topic and your tutor will guide you through it with
            questions, feedback, and encouragement.
          </p>
        </div>

        <div className="space-y-3">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="topic-card w-full rounded-2xl px-6 py-5 text-left cursor-pointer"
            >
              <div className="font-display text-lg text-stone-800">
                {t.label}
              </div>
              <div className="text-stone-400 text-sm mt-0.5">
                {t.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
