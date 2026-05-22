"use client";

import { useEffect, useState } from "react";
import CourseSelector from "./components/CourseSelector";
import ModuleSelector from "@/app/components/ModuleSelector";
import ChatWindow from "@/app/components/ChatWindow";
import { useTutorSession } from "@/hooks/useTutorSession";
import { fetchCourses, fetchModules } from "./services/fetchCourseMaterials";
import { CanvasCourse, CanvasModule } from "./types/canvas";

export default function Home() {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [modules, setModules] = useState<CanvasModule[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CanvasCourse | null>(
    null,
  );
  const [selectedModule, setSelectedModule] = useState<CanvasModule | null>(
    null,
  );
  const [coursesLoading, setCoursesLoading] = useState(true);
  const CONTENT_TYPES_TO_KEEP = ["wikipage"];
  const tutorSession = useTutorSession({
    topic: selectedModule?.title,
    moduleItems:
      selectedModule?.module_items.filter((item) =>
        CONTENT_TYPES_TO_KEEP.includes(item.content_type),
      ) ?? [],
  });

  async function handleCourseSelect(course: CanvasCourse) {
    setSelectedCourse(course);
    setModules([]);

    try {
      const data = await fetchModules(course.id);

      if (data.success) {
        setModules(data.modules);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    async function loadCourses() {
      try {
        const data = await fetchCourses();

        if (data.success) {
          setCourses(data.courses);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCoursesLoading(false);
      }
    }

    loadCourses();
  }, []);

  if (!selectedCourse) {
    return (
      <CourseSelector
        courses={courses}
        loading={coursesLoading}
        onSelect={handleCourseSelect}
      />
    );
  }

  if (!selectedModule) {
    return (
      <ModuleSelector
        course={selectedCourse}
        modules={modules}
        onBack={() => {
          setSelectedCourse(null);
          setModules([]);
        }}
        onSelect={setSelectedModule}
      />
    );
  }
  const topicLabel = `${selectedCourse.title} · ${selectedModule.title}`;

  return (
    <div
      className="min-h-screen bg-stone-50 flex flex-col"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .font-display { font-family: 'Lora', Georgia, serif; }
        .send-btn { background: #c2784a; transition: background 0.15s ease, transform 0.1s ease; }
        .send-btn:hover { background: #a8633c; }
        .send-btn:active { transform: scale(0.97); }
        .mic-btn-active { background: #dc2626; animation: micpulse 1.5s infinite; }
        @keyframes micpulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
        }
      `}</style>

      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-display text-lg text-stone-800">
              MentorAI
            </span>
            <span className="mx-2 text-stone-300">·</span>
            <span className="text-sm text-stone-500">{topicLabel}</span>
          </div>
          <button
            onClick={() => {
              setSelectedCourse(null);
              setSelectedModule(null);
              setModules([]);

              tutorSession.resetSession();
            }}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors border border-stone-200 rounded-full px-3 py-1"
          >
            Change topic
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6 min-h-0">
        <ChatWindow
          messages={tutorSession.messages}
          interrupt={tutorSession.interrupt}
          isLoading={tutorSession.isLoading}
          sessionComplete={tutorSession.sessionComplete}
          recommendations={tutorSession.recommendations}
          selectedSubtopics={tutorSession.selectedSubtopics}
          onSend={tutorSession.handleSend}
          onSubtopicToggle={tutorSession.handleSubtopicToggle}
          onSubtopicsSubmit={tutorSession.handleSubtopicsSubmit}
          onContinue={tutorSession.handleContinue}
          subtopicName={tutorSession.subtopicName}
          subtopicIndex={tutorSession.subtopicIndex}
          subtopicTotal={tutorSession.subtopicTotal}
          questionIndex={tutorSession.questionIndex}
          questionTotal={tutorSession.questionTotal}
          voiceEnabled={tutorSession.voiceEnabled}
          setVoiceEnabled={tutorSession.setVoiceEnabled}
        />
      </div>
    </div>
  );
}
