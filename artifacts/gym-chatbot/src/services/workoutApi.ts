const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const HEADERS = { "Content-Type": "application/json" };

export interface Exercise {
  exercise_id: string;
  category: string;
  level: string;
  title: string;
  description: string;
  [key: string]: unknown;
}

async function callProxy(path: string, method: "GET" | "POST", body?: object): Promise<unknown> {
  const url = `${BASE}/api/webhook-proxy/${path}`;
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data;
}

export async function fetchExercises(): Promise<Exercise[]> {
  const data = await callProxy("gymbot_exercises", "GET");
  console.log("Exercises raw response:", data);
  let list: Exercise[] = [];
  if (Array.isArray(data)) {
    list = data as Exercise[];
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    list = [data as Exercise];
  }
  // Normalize exercise_id to string
  return list.map(ex => ({ ...ex, exercise_id: String(ex.exercise_id) }));
}

export async function addExercise(exercise: {
  exercise_id: string;
  category: string;
  level: string;
  title: string;
  description: string;
}): Promise<void> {
  await callProxy("gymbot_exercise_add", "POST", exercise);
}

export async function updateExercise(exercise: {
  exercise_id: string;
  category: string;
  level: string;
  title: string;
  description: string;
}): Promise<void> {
  await callProxy("gymbot_exercise_update", "POST", exercise);
}

export async function deleteExercise(exercise_id: string): Promise<void> {
  await callProxy("gymbot_exercise_delete", "POST", { exercise_id });
}

export const CATEGORIES = [
  { id: 1, name: "chest" },
  { id: 2, name: "back" },
  { id: 3, name: "legs" },
  { id: 4, name: "shoulders" },
  { id: 5, name: "biceps" },
  { id: 6, name: "triceps" },
  { id: 7, name: "abs" },
  { id: 8, name: "cardio" },
];

export const LEVELS = ["beginner", "advanced"];

export const CATEGORY_COLORS: Record<string, string> = {
  chest:     "bg-red-100 text-red-700 border-red-200",
  back:      "bg-blue-100 text-blue-700 border-blue-200",
  legs:      "bg-green-100 text-green-700 border-green-200",
  shoulders: "bg-purple-100 text-purple-700 border-purple-200",
  biceps:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  triceps:   "bg-orange-100 text-orange-700 border-orange-200",
  abs:       "bg-pink-100 text-pink-700 border-pink-200",
  cardio:    "bg-cyan-100 text-cyan-700 border-cyan-200",
};

export const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  advanced: "bg-rose-100 text-rose-700",
};

export function buildExerciseId(categoryName: string, level: string): string {
  const cat = CATEGORIES.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
  const catNum = cat?.id ?? 1;
  const levelNum = level === "beginner" ? 1 : 2;
  return `${catNum}_${levelNum}`;
}
