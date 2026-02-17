export type ImproveRequestParams = {
  analysis: Record<string, unknown>;
  selectedPoints: string[];
  candidates: unknown[];
  targetIds: string[];
  feedback?: Record<string, unknown>;
};

export function buildImproveRequestBody(params: ImproveRequestParams): Record<string, unknown> {
  return {
    analysis: params.analysis,
    selected_points: params.selectedPoints,
    candidates: params.candidates,
    target_ids: params.targetIds,
    feedback: params.feedback,
  };
}
