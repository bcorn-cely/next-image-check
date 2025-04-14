export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(id)
      return response
    } catch (error) {
      clearTimeout(id)
      throw error
    }
  }
  
  // Parse cache status from response headers
  export function parseCacheStatus(headers: Headers): {
    cacheHit: boolean
    cacheProvider?: string
    ttl?: number
    cacheControl?: string
  } {
    const result = {
      cacheHit: false,
      cacheProvider: undefined as string | undefined,
      ttl: undefined as number | undefined,
      cacheControl: undefined as string | undefined,
    }
  
    // Check for Vercel's cache header
    const vercelCache = headers.get("x-vercel-cache")
    if (vercelCache) {
      result.cacheHit = vercelCache === "HIT"
      result.cacheProvider = "Vercel"
    }
  
    // Check for Cloudflare's cache header
    const cfCache = headers.get("cf-cache-status")
    if (cfCache) {
      result.cacheHit = cfCache === "HIT"
      result.cacheProvider = "Cloudflare"
    }

    // Check for AWS Cache
    const awsCache = headers.get('x-cache');
    if(awsCache && awsCache.includes('cloudfront')) {
        result.cacheHit = awsCache.includes('HIT');
        result.cacheProvider = 'Cloudfront';
    }
  
    // Check for Fastly cache header
    const fastlyCache = headers.get("x-cache")
    const fastlyXServedBy = headers.get('x-served-by');
    // checking structure of fastly x-served-by header to match docs: https://www.fastly.com/documentation/reference/http/http-headers/X-Served-By/
    if (fastlyCache && (fastlyXServedBy && !result.cacheProvider)) {
        const fastlyPattern = /cache-[a-z]{3}-[a-z]+\d+-[a-z]{3}/i;
        if(fastlyPattern.test(fastlyXServedBy.split(',')[0].trim())){
            result.cacheHit = fastlyCache.includes("HIT")
            result.cacheProvider = "Fastly"
        }
    }
  
    // Check for Akamai cache header
    const akamaiCache = headers.get("x-cache")
    if (akamaiCache && !result.cacheProvider && akamaiCache.includes('TCP')) {
      result.cacheHit = akamaiCache.includes("HIT")
      result.cacheProvider = "Akamai"
    }
  
    // Check standard cache-control header
    const cacheControl = headers.get("cache-control")
    if (cacheControl) {
      result.cacheControl = cacheControl
  
      // Extract max-age if available
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
      if (maxAgeMatch && maxAgeMatch[1]) {
        result.ttl = Number.parseInt(maxAgeMatch[1], 10)
      }
  
      // If no specific cache provider was identified but we have cache-control
      if (!result.cacheProvider && (cacheControl.includes("public") || cacheControl.includes("private"))) {
        result.cacheProvider = "Generic"
      }
    }
  
    return result
  }
  