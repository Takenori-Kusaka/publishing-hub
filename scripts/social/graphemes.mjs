/**
 * Counts grapheme clusters (user-perceived characters) in a string using Intl.Segmenter.
 * This ensures accurate counting of multi-byte characters, emojis, and combined characters for Bluesky.
 *
 * @param {string} text
 * @returns {number}
 */
export function countGraphemes(text) {
  if (!text) return 0;
  const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  let count = 0;
  for (const _ of segmenter.segment(text)) {
    count++;
  }
  return count;
}
