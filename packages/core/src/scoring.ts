import { isValidAnswer, normaliseAnswer } from './answers';
import type { AllAnswers, CategoryScore, PlayerId, RoundResult } from './types';

/** Points each player gets when `count` players gave the same answer. */
export function pointsForShared(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 10;
  if (count === 2) return 5;
  if (count === 3) return 3;
  return 2;
}

export interface Rejection {
  playerId: PlayerId;
  category: string;
}

export interface ScoreOptions {
  /** Answers voted out by the other players; they score 0 and don't count as shared. */
  rejected?: Rejection[];
}

export function scoreRound(
  allAnswers: AllAnswers,
  categories: string[],
  letter: string,
  options: ScoreOptions = {},
): RoundResult {
  const rejected = options.rejected ?? [];
  const isRejected = (playerId: PlayerId, category: string) =>
    rejected.some((r) => r.playerId === playerId && r.category === category);
  const playerIds = Object.keys(allAnswers);

  const scores: RoundResult['scores'] = {};
  const roundTotals: RoundResult['roundTotals'] = {};
  for (const id of playerIds) {
    scores[id] = {};
    roundTotals[id] = 0;
  }

  for (const category of categories) {
    const counts = new Map<string, number>();
    const entries = playerIds.map((id) => {
      const answer = allAnswers[id][category] ?? '';
      const normalised = normaliseAnswer(answer);
      const wasRejected = isRejected(id, category);
      const valid = !wasRejected && isValidAnswer(answer, letter);
      if (valid) counts.set(normalised, (counts.get(normalised) ?? 0) + 1);
      return { id, answer, normalised, valid, wasRejected };
    });

    for (const e of entries) {
      const sharedWith = e.valid ? (counts.get(e.normalised) ?? 0) : 0;
      const score: CategoryScore = {
        answer: e.answer,
        normalised: e.normalised,
        valid: e.valid,
        sharedWith,
        points: pointsForShared(sharedWith),
        rejected: e.wasRejected,
      };
      scores[e.id][category] = score;
      roundTotals[e.id] += score.points;
    }
  }

  return { letter, categories: [...categories], scores, roundTotals };
}

export interface Standing {
  playerId: PlayerId;
  total: number;
  /** 1-based; tied players share a rank. */
  rank: number;
}

export function standings(totals: Record<PlayerId, number>): Standing[] {
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return sorted.map(([playerId, total]) => ({
    playerId,
    total,
    rank: sorted.findIndex(([, t]) => t === total) + 1,
  }));
}

/** Everyone tied for first place. Empty if there are no players. */
export function winners(totals: Record<PlayerId, number>): PlayerId[] {
  return standings(totals)
    .filter((s) => s.rank === 1)
    .map((s) => s.playerId);
}
