export interface RawRssItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  snippet?: string;
}

/**
 * Clean and decode XML / HTML entities without external dependencies.
 */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Parses Google News RSS XML into clean item metadata.
 */
export function parseGoogleNewsRss(xmlText: string): RawRssItem[] {
  const results: RawRssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);

    let rawTitle = titleMatch ? titleMatch[1] : '';
    let link = linkMatch ? linkMatch[1] : '';
    let pubDate = pubDateMatch ? pubDateMatch[1] : '';
    let source = sourceMatch ? sourceMatch[1] : '';
    const rawDesc = descMatch ? descMatch[1] : '';

    rawTitle = rawTitle.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    link = link.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    pubDate = pubDate.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    source = source.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();

    let cleanTitle = decodeEntities(rawTitle).trim();
    const cleanSource = decodeEntities(source).trim();

    if (!cleanSource && cleanTitle.includes(' - ')) {
      const parts = cleanTitle.split(' - ');
      source = parts.pop() || 'Regional News';
      cleanTitle = parts.join(' - ').trim();
    }

    const strippedDesc = decodeEntities(rawDesc.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

    if (cleanTitle) {
      results.push({
        title: cleanTitle,
        link,
        pubDate,
        source: cleanSource || source || 'Regional Media',
        snippet: strippedDesc || undefined,
      });
    }
  }

  return results;
}

/**
 * Vercel Serverless Function Handler for Regional Safety News RSS Proxy.
 * Solves browser CORS restrictions by proxying requests server-side.
 */
export default async function handler(req: any, res: any) {
  // 1. CORS Headers
  if (res?.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
  }

  // Preflight check
  if (req?.method === 'OPTIONS') {
    if (res?.status) return res.status(200).end();
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    let query = '';
    let countryCode = 'IN';

    // Parse query parameter from Node req.query or Web Fetch req.url
    if (req?.query) {
      query = typeof req.query.q === 'string' ? req.query.q : '';
      if (typeof req.query.country === 'string') {
        countryCode = req.query.country.toUpperCase();
      }
    } else if (req?.url) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        query = urlObj.searchParams.get('q') || '';
        const c = urlObj.searchParams.get('country');
        if (c) countryCode = c.toUpperCase();
      } catch {
        // Ignore URL parsing errors
      }
    }

    if (!query) {
      const emptyPayload = {
        success: true,
        query: '',
        articles: [],
        message: 'No search query provided.',
      };
      if (res?.status) return res.status(200).json(emptyPayload);
      return new Response(JSON.stringify(emptyPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const country = countryCode.toUpperCase();
    const hl = country === 'US' ? 'en-US' : country === 'GB' ? 'en-GB' : country === 'CA' ? 'en-CA' : country === 'AU' ? 'en-AU' : country === 'IN' ? 'en-IN' : `en-${country}`;
    const gl = country;
    const ceid = `${country}:en`;
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const upstreamResponse = await fetch(googleNewsUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'SafeHer-AI/1.0 (Regional Safety Information Service)',
      },
    });
    clearTimeout(timeoutId);

    if (!upstreamResponse.ok) {
      const errorPayload = {
        success: false,
        error: `Upstream Google News RSS returned status ${upstreamResponse.status}`,
      };
      if (res?.status) return res.status(502).json(errorPayload);
      return new Response(JSON.stringify(errorPayload), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const xmlText = await upstreamResponse.text();
    const articles = parseGoogleNewsRss(xmlText);

    const payload = {
      success: true,
      query,
      articles,
    };

    if (res?.status) return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    console.error('Error in safety-news API handler:', err?.message || err);
    const errorPayload = {
      success: false,
      error: err?.message || 'Failed to fetch regional safety news',
    };
    if (res?.status) return res.status(500).json(errorPayload);
    return new Response(JSON.stringify(errorPayload), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
