/**
 * Analyze & expand service. Orchestrates catalog, mechanism matching, outline, evidence, tracks, plot cards.
 * Implementation split into: analyze/catalog, outline, evidence, tracks, plotCards.
 */
import { classify } from "../lib/classifier.js";
import { matchScifi, matchByMechanism } from "./analyze/catalog.js";
import { buildAnalyzePodcastOutline, buildPodcastOutline } from "./analyze/outline.js";
import { buildAnalyzeEvidenceChain, buildEvidenceChain } from "./analyze/evidence.js";
import { buildRecommendedTracks } from "./analyze/tracks.js";
import { buildPlotSupportCards } from "./analyze/plotCards.js";
import type { AnalyzeResult, ExpandResult } from "./analyze/types.js";

export type { ScifiEntry, ScifiCandidate, RecommendedTrack } from "./analyze/types.js";
export type {
  AnalyzeEvidenceRef,
  AnalyzeEvidenceLink,
  AnalyzePodcastOutline,
  AnalyzeResult,
  PlotSupportCard,
  EvidenceLink,
  ExpandResult,
} from "./analyze/types.js";

export function analyze(text: string): AnalyzeResult {
  const categories = classify(text);
  const topCats = categories.length > 0 ? categories : [{ category: "space", score: 1 }];
  const matches = matchScifi(topCats, 10);
  const mechanismMatches = matchByMechanism(text, 2);
  const recommendedTracks = buildRecommendedTracks(
    topCats.map((c) => ({ category: c.category, score: c.score })),
    matches,
    mechanismMatches,
  );
  const podcastOutline = buildAnalyzePodcastOutline(
    topCats.map((c) => ({ category: c.category, score: c.score })),
    matches,
    mechanismMatches,
  );
  const evidenceChain = buildAnalyzeEvidenceChain(
    topCats.map((c) => ({ category: c.category, score: c.score })),
    matches,
    mechanismMatches,
  );

  return {
    categories: topCats.map((c) => ({ category: c.category, score: c.score })),
    scifiMatches: matches,
    mechanismMatches,
    recommendedTracks,
    podcastOutline,
    evidenceChain,
  };
}

export function expand(
  text: string,
  selectedCategories: string[],
  selectedWorkTitles: string[],
  selectedTrackId?: string,
): ExpandResult {
  const result = analyze(text);
  let cats = selectedCategories;
  let workTitles = selectedWorkTitles;
  if (selectedTrackId) {
    const track = result.recommendedTracks.find((t) => t.trackId === selectedTrackId);
    if (track) {
      cats = track.categoryIds;
      workTitles = track.scifiCandidateTitles;
    }
  }
  const allWorks = [...result.scifiMatches, ...result.mechanismMatches];
  const selectedWorks = allWorks.filter((w) =>
    workTitles.length ? workTitles.includes(w.title) : true,
  );
  const categoryIds = cats.length > 0 ? cats : result.categories.map((c) => c.category);
  const works = selectedWorks.length ? selectedWorks : allWorks.slice(0, 5);

  const plotSupportCards = buildPlotSupportCards(categoryIds, works);
  const evidenceChain = buildEvidenceChain(categoryIds, works);
  const podcastOutline = buildPodcastOutline(categoryIds, works);

  return {
    plotSupportCards,
    podcastOutline,
    evidenceChain,
  };
}
