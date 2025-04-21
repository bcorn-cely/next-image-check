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
      result.cacheHit = cfCache.toLowerCase() === "hit"
      result.cacheProvider = "Cloudflare"
    }

    // Check for AWS Cache
    const awsCache = headers.get('x-cache');
    if(awsCache && awsCache.includes('cloudfront')) {
        result.cacheHit = awsCache.toLowerCase().includes('hit');
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
    // Check for Adobe AEM cache header
    const adobeCache = headers.get('x-adobe-cachekey');
    if(!result.cacheProvider && adobeCache) {
        result.cacheProvider = 'Adobe AEM';
    }
  
    // Check standard cache-control header
    const cacheControl = headers.get("cache-control")
    if (cacheControl) {
      result.cacheControl = cacheControl
      
      // Check expiration for HIT if no cacheHit result has been found yet
      const expire = headers.get('Expires');
      if(expire && !result.cacheHit) {
        const expireDate = new Date(expire);
        if(isNaN(expireDate.getTime())) {
            console.error('Invalid date format');
        }
        const currentDate = new Date();
        result.cacheHit = expireDate > currentDate;
      }
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

  // Add function to parse server information from headers
export function parseServerInfo(headers: Headers): {
    server?: string
    provider?: string
    location?: string
  } {
    const result = {
      server: undefined as string | undefined,
      provider: undefined as string | undefined,
      location: undefined as string | undefined,
    }
  
    // Extract server header
    const serverHeader = headers.get("server")
    if (serverHeader) {
      result.server = serverHeader
    }
  
    // Identify provider based on headers
    if (serverHeader?.includes("AmazonS3") || serverHeader?.includes("Amazon")) {
      result.provider = "Amazon S3"
    } else if (serverHeader?.includes('Cloudinary')) {
        result.provider = 'Cloudinary';
    } else if (serverHeader?.includes("cloudflare")) {
        result.provider = "Cloudflare"
    } else if (serverHeader?.includes("gws") || headers.get("x-goog-storage-class")) {
        result.provider = "Google Cloud Storage"
    } else if (serverHeader?.includes("Microsoft-IIS") || headers.get("x-ms-request-id")) {
        result.provider = "Azure Storage"
    } else if (serverHeader?.includes('Unknown') && headers.get('X-Adobe-Cachekey')) {
        result.provider = "Adobe AEM"; 
    } else if (headers.get("x-amz-cf-id") || headers.get("x-amz-cf-pop")) {
        result.provider = "Amazon CloudFront"
    } else if (headers.get("x-akamai-transformed")) {
        result.provider = "Akamai"
    } else if (headers.get("x-fastly-request-id")) {
        result.provider = "Fastly"
    } else if (headers.get("x-vercel-cache")) {
        result.provider = "Vercel"
    } else if (headers.get("x-served-by")?.includes("cache")) {
        result.provider = "Varnish Cache"
    } else if (headers.get("x-cdn")) {
        result.provider = headers.get("x-cdn") || undefined
    }
  
    // Try to determine geographic location
    const cfRay = headers.get("cf-ray")
    if (cfRay) {
      // Extract location code from Cloudflare ray ID (e.g., "SJC" from "6d044f5aecc1e99e-SJC")
      const locationCode = cfRay.split("-")[1]
      if (locationCode) {
        result.location = locationCode
      }
    }
  
    // Check for Fastly POP location
    const fastlyPop = headers.get("x-served-by")
    if (fastlyPop && fastlyPop.includes("cache-")) {
      const popMatch = fastlyPop.match(/cache-([a-z]{3})/i)
      if (popMatch && popMatch[1]) {
        result.location = popMatch[1].toUpperCase()
      }
    }
  
    // Check for AWS CloudFront POP
    const cfPop = headers.get("x-amz-cf-pop")
    if (cfPop) {
      result.location = cfPop
    }
  
    return result
  }
  