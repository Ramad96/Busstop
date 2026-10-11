import { MAX_ANSWER_LENGTH } from './constants';
import type { Answers } from './types';

/**
 * Normalises an answer for comparison: ignores capitals, accents, spaces,
 * punctuation and a leading "the" (so "The Gap" = "gap").
 */
export function normaliseAnswer(answer: string): string {
  return answer
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** An answer is valid if it is not blank and starts with the round's letter. */
export function isValidAnswer(answer: string, letter: string): boolean {
  const normalised = normaliseAnswer(answer);
  return normalised.length > 0 && normalised[0] === letter.toLowerCase();
}

/** True when every category has a valid answer. Unlocks "Stop the clock". */
export function allAnswersValid(answers: Answers, categories: string[], letter: string): boolean {
  return categories.every((c) => isValidAnswer(answers[c] ?? '', letter));
}

/** Keeps only known categories, trims and caps length. */
export function sanitiseAnswers(answers: unknown, categories: string[]): Answers {
  const result: Answers = {};
  if (typeof answers !== 'object' || answers === null) return result;
  const record = answers as Record<string, unknown>;
  for (const category of categories) {
    const value = record[category];
    if (typeof value === 'string') result[category] = value.trim().slice(0, MAX_ANSWER_LENGTH);
  }
  return result;
}
