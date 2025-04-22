export interface ImageDimensions {
  width: number
  height: number
}

export interface SrcSetAnalysis {
  transformationCount: number
  hasAppropriateRange: boolean
  hasMobileSize: boolean
  hasDesktopSize: boolean
  sizeRange: { min: number; max: number } | null
}

export interface CacheInfo {
  cacheHit: boolean
  cacheProvider?: string
  ttl?: number
  cacheControl?: string
}

export interface ImageInfo {
  src: string
  size: number
  format?: string
  dimensions?: ImageDimensions
  optimizationScore: number
  isLCP: boolean
  isUsingNextImage?: boolean
  isInViewport?: boolean
  isVisible?: boolean
  recommendations: string[]
  srcset?: string
  srcsetAnalysis?: SrcSetAnalysis
  cacheInfo?: CacheInfo
  responseTime?: number
  serverInfo: {
    server: string
    provider: string
    location: string
  }
}

export interface ImageAnalysis {
  url: string
  images: ImageInfo[]
  totalSize: number
  potentialSavings: number
  potentialSavingsPercentage: number
  isLikelyNextJsSite?: boolean
  renderedWithPuppeteer?: boolean
  totalTransformations?: number
  cachedImagesPercentage?: number
}
