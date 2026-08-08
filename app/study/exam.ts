export type VerificationStatus = "official" | "verified_summary" | "pending";
export type SourceStatus = "active" | "superseded" | "unavailable" | "pending_review";
export type ScopeStatus = "examRequired" | "prerequisite" | "supporting" | "outOfScope";

export interface SourceRecord {
  id: string;
  title: string;
  authority: "national_exam_authority" | "provincial_exam_authority" | "government_education_department" | "official_publisher" | "licensed_material" | "secondary_lead";
  url?: string;
  publicationDate?: string;
  retrievedAt: string;
  documentVersion?: string;
  pageOrSection?: string;
  checksum?: string;
  status: SourceStatus;
  notes?: string;
}

export interface CourseProfile {
  currentCode: string;
  currentName: string;
  legacyCode: string;
  legacyName: string;
  syllabusName: string;
  textbook: { title: string; authors: string[]; publisher: string; edition: string };
  regionApplicability: string;
  effectiveFrom: string;
  reviewedAt: string;
  sourceRefs: string[];
  verificationStatus: VerificationStatus;
}

export interface SyllabusNode {
  id: string;
  parentId?: string;
  title: string;
  summary: string;
  category: "knowledge" | "vocabulary" | "grammar" | "reading" | "translation" | "writing" | "exam_task" | "prerequisite";
  requirementLevel: "recognize" | "understand" | "apply" | "integrate";
  importance: "core" | "important" | "supporting";
  stageIds: string[];
  lessonIds: string[];
  prerequisiteNodeIds: string[];
  evidenceRule: string;
  sourceRefs: Array<{ sourceId: string; pageOrSection?: string }>;
  verificationStatus: VerificationStatus;
}

export interface ExamScopeItem {
  id: string;
  title: string;
  status: ScopeStatus;
  priority: "P0" | "P1" | "P2";
  expectedStudyAmount: string;
  targetWeeks: number[];
  syllabusNodeIds: string[];
  lessonIds: string[];
  verificationStatus: VerificationStatus;
  sourceRefs: string[];
}

export interface QuestionTypeInfo {
  id: string;
  title: string;
  ability: string;
  responseFormat: string;
  questionCount: number | null;
  score: number | null;
  durationMinutes: number | null;
  applicableSessions: string[];
  verificationStatus: VerificationStatus;
  sourceRefs: string[];
  notes: string;
}

export interface TextbookMapItem {
  unitId: string;
  title: string;
  learningObjectives: string[];
  syllabusNodeIds: string[];
  lessonIds: string[];
  vocabularySetIds: string[];
  grammarPointIds: string[];
  coverageStatus: "mapped" | "partial" | "pending";
  sourceRefs: string[];
  pageRange?: string;
}

export interface ExamDataBundle {
  sources: SourceRecord[];
  course: CourseProfile;
  syllabus: SyllabusNode[];
  scope: ExamScopeItem[];
  questionTypes: QuestionTypeInfo[];
  textbookMap: TextbookMapItem[];
}

const json = (path: string) => fetch(path).then((response) => {
  if (!response.ok) throw new Error(`考试资料加载失败: ${response.status}`);
  return response.json();
});

export async function loadExamData(): Promise<ExamDataBundle> {
  const [sources, course, syllabus, scope, questionTypes, textbookMap] = await Promise.all([
    json("/data/exam/source_registry.json"),
    json("/data/exam/course_profile.json"),
    json("/data/exam/syllabus_outline.json"),
    json("/data/exam/exam_scope.json"),
    json("/data/exam/question_types.json"),
    json("/data/exam/textbook_map.json"),
  ]);
  return { sources, course, syllabus, scope, questionTypes, textbookMap };
}

export function getExamCoverage(nodes: SyllabusNode[], progress: Record<string, { coverageEvidence: number; masteryEvidence: number }>) {
  const official = nodes.filter((node) => node.verificationStatus !== "pending");
  const weight = (node: SyllabusNode) => node.importance === "core" ? 3 : node.importance === "important" ? 2 : 1;
  const total = official.reduce((sum, node) => sum + weight(node), 0) || 1;
  const coverage = official.reduce((sum, node) => sum + Math.min(1, progress[node.id]?.coverageEvidence ?? 0) * weight(node), 0);
  const mastery = official.reduce((sum, node) => sum + Math.min(1, progress[node.id]?.masteryEvidence ?? 0) * weight(node), 0);
  return { coverage: Math.round((coverage / total) * 100), mastery: Math.round((mastery / total) * 100), officialCount: official.length, pendingCount: nodes.length - official.length };
}
