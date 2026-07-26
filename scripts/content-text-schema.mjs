import { z } from 'astro/zod';

export const contentText = z.union([
  z.string(),
  z.number(),
]).transform((value) => String(value));

export const contentTextArray = z.array(contentText);

export function contentTextMax(maximum) {
  return contentText.refine(
    (value) => value.length <= maximum,
    `Text must contain at most ${maximum} characters.`,
  );
}
