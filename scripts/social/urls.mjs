/**
 * Injects standard UTM tracking parameters into a URL using WHATWG URL.
 * Throws an error if any of the UTM parameters already exist to prevent silent overwriting.
 *
 * @param {string} urlStr
 * @param {object} params - { source, medium, campaign, content }
 * @returns {string} - The updated URL string
 */
export function injectUTM(urlStr, { source, medium, campaign, content }) {
  if (!urlStr) return '';
  const url = new URL(urlStr);

  const utmParams = {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
    utm_content: content
  };

  for (const [key, val] of Object.entries(utmParams)) {
    if (val) {
      if (url.searchParams.has(key)) {
        throw new Error(`Duplicate UTM parameter detected: URL '${urlStr}' already contains '${key}'`);
      }
      url.searchParams.set(key, val);
    }
  }

  return url.toString();
}
