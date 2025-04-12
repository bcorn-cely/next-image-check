export interface ImageDimensions {
  width: number
  height: number
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
}

export interface ImageAnalysis {
  url: string
  images: ImageInfo[]
  totalSize: number
  potentialSavings: number
  potentialSavingsPercentage: number
  isLikelyNextJsSite?: boolean
  renderedWithPuppeteer?: boolean
}
