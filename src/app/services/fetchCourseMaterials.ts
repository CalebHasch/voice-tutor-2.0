export async function fetchCourses() {
  const res = await fetch("/api/courses");

  if (!res.ok) {
    throw new Error("Failed to fetch courses");
  }

  return res.json();
}

export async function fetchModules(courseId: string) {
  const res = await fetch(`/api/courses/${courseId}/modules`);

  if (!res.ok) {
    throw new Error("Failed to fetch modules");
  }

  return res.json();
}
