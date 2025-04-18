// Function to get image type from URL or content-type
export function getImageFormatFromUrl(url: string, contentType?: string): string {
    if (contentType && contentType.startsWith("image/")) {
      return contentType.split("/")[1]
    }
  
    const extension = url.split(".").pop()?.toLowerCase()
    if (extension) {
      if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(extension)) {
        return extension === "jpg" ? "jpeg" : extension
      }
    }
    return "unknown"
  }
  
  // Function to detect if an image is using Next.js Image component
  export function isNextImageComponent(imgElement: any): boolean {
    // Check for Next.js Image component specific attributes
    if (imgElement.hasAttribute("data-nimg")) {
      return true
    }
  
    // Check for Next.js specific parent structure
    const parent = imgElement.parentNode
    if (parent && parent.tagName === "SPAN" && parent.hasAttribute("style")) {
      const style = parent.getAttribute("style") || ""
      if (style.includes("box-sizing:border-box") && style.includes("display:inline-block")) {
        return true
      }
    }
  
    // Check for Next.js specific class names or patterns
    const className = imgElement.getAttribute("class") || ""
    if (className.includes("__next-image") || className.includes("next-image")) {
      return true
    }
  
    // Check for srcSet pattern that Next.js Image typically generates
    const srcSet = imgElement.getAttribute("srcset") || ""
    if (srcSet.includes("/_next/image")) {
      return true
    }
  
    return false
  }
  
  // Parse srcset attribute to extract different image sizes and URLs
  export function parseSrcSet(srcset: string): Array<{ url: string; width?: number; density?: number }> {
    if (!srcset) return []
  
    return srcset
      .split(",")
      .map((src) => {
        const [url, descriptor] = src.trim().split(/\s+/)
        if (!url || !descriptor) return null
  
        // Width descriptor (e.g., "100w")
        if (descriptor.endsWith("w")) {
          const width = Number.parseInt(descriptor.slice(0, -1), 10)
          return { url, width }
        }
        // Density descriptor (e.g., "2x")
        else if (descriptor.endsWith("x")) {
          const density = Number.parseFloat(descriptor.slice(0, -1))
          return { url, density }
        }
  
        return { url }
      })
      .filter(Boolean) as Array<{ url: string; width?: number; density?: number }>
  }
  
  // Analyze srcset for quality and coverage
  export function analyzeSrcSet(srcsetItems: Array<{ url: string; width?: number; density?: number }>): {
    transformationCount: number
    hasAppropriateRange: boolean
    hasMobileSize: boolean
    hasDesktopSize: boolean
    sizeRange: { min: number; max: number } | null
  } {
    if (!srcsetItems.length) {
      return {
        transformationCount: 0,
        hasAppropriateRange: false,
        hasMobileSize: false,
        hasDesktopSize: false,
        sizeRange: null,
      }
    }
  
    const transformationCount = srcsetItems.length
  
    // Analyze width-based srcset
    const widths = srcsetItems.map((item) => item.width).filter((width) => typeof width === "number") as number[]
  
    if (widths.length) {
      const min = Math.min(...widths)
      const max = Math.max(...widths)
  
      return {
        transformationCount,
        hasAppropriateRange: max / min >= 2, // At least 2x difference between smallest and largest
        hasMobileSize: min <= 640, // Common mobile breakpoint
        hasDesktopSize: max >= 1024, // Common desktop breakpoint
        sizeRange: { min, max },
      }
    }
  
    // Analyze density-based srcset
    const densities = srcsetItems.map((item) => item.density).filter((density) => typeof density === "number") as number[]
  
    if (densities.length) {
      const min = Math.min(...densities)
      const max = Math.max(...densities)
  
      return {
        transformationCount,
        hasAppropriateRange: max >= 2, // At least 2x density for high-DPI displays
        hasMobileSize: true, // Density-based srcset works for all sizes
        hasDesktopSize: true,
        sizeRange: null, // No specific size range for density-based srcset
      }
    }
  
    return {
      transformationCount,
      hasAppropriateRange: false,
      hasMobileSize: false,
      hasDesktopSize: false,
      sizeRange: null,
    }
  }
  
  export function calculateOptimizationScore(
    format: string,
    size: number,
    dimensions?: { width: number; height: number },
    isUsingNextImage = false,
    srcsetAnalysis?: ReturnType<typeof analyzeSrcSet>,
    cacheInfo?: { cacheHit: boolean; cacheProvider?: string },
  ): number {
    // Start with a perfect score and deduct points for issues
    let score = 100
  
    // CRITICAL: Cache penalty - apply this first and make it significant
    // If cache info exists and the image is not cached, apply a significant penalty
    if (cacheInfo && !cacheInfo.cacheHit) {
      score -= 15 // Significant penalty for non-cached images
    }
  
    // Format-based scoring
    if (format === "webp" || format === "avif") {
      // Modern formats are good - no deduction
    } else if (format === "png") {
      // PNG is often larger than necessary for photos
      score -= 15
    } else if (format === "jpeg" || format === "jpg") {
      // JPEG is common but not as efficient as WebP
      score -= 10
    } else if (format === "gif") {
      // GIF is often inefficient
      score -= 30
    } else {
      // Unknown or other formats
      score -= 5
    }
  
    // Size-based scoring
    if (size > 1000000) {
      // > 1MB
      score -= 20
    } else if (size > 500000) {
      // > 500KB
      score -= 10
    } else if (size > 200000) {
      // > 200KB
      score -= 5
    } else if (size > 100000) {
      // > 100KB
      score -= 0
    }
  
    // Dimension-based scoring
    if (dimensions) {
      const { width, height } = dimensions
      const totalPixels = width * height
  
      if (totalPixels > 2000000) {
        // > 2MP
        score -= 15
      } else if (totalPixels > 1000000) {
        // > 1MP
        score -= 10
      } else if (totalPixels > 500000) {
        // > 0.5MP
        score -= 5
      }
    }
  
    // Responsive image scoring
    if (!srcsetAnalysis || srcsetAnalysis.transformationCount === 0) {
      // Penalize for no responsive images
      score -= 15
    } else if (srcsetAnalysis.transformationCount < 2) {
      // Minor penalty for limited responsive options
      score -= 5
    }
  
    // Next.js Image component scoring
    if (!isUsingNextImage) {
      // Penalize for not using Next.js Image
      score -= 15
    }
  
    // Ensure score is within 0-100 range
    return Math.max(0, Math.min(100, score))
  }
  
  export function generateRecommendations(
    format: string,
    size: number,
    dimensions?: { width: number; height: number },
    isUsingNextImage = false,
    isLikelyNextJsSite = false,
    srcsetAnalysis?: ReturnType<typeof analyzeSrcSet>,
    cacheInfo?: { cacheHit: boolean; cacheProvider?: string; ttl?: number },
  ): string[] {
    const recommendations: string[] = []
  
    // Cache recommendations - CRITICAL
    if (cacheInfo && !cacheInfo.cacheHit) {
      recommendations.unshift(
        "Image is not being served from cache - set appropriate cache headers to improve performance",
      )
    } else if (cacheInfo && cacheInfo.ttl !== undefined && cacheInfo.ttl < 86400) {
      // Less than 1 day
      recommendations.push(`Consider increasing cache TTL (currently ${cacheInfo.ttl} seconds) to reduce origin requests`)
    }
  
    // Next.js Image component recommendations
    if (!isUsingNextImage) {
      if (isLikelyNextJsSite) {
        recommendations.push("Replace standard <img> tag with Next.js Image component for automatic optimization")
      } else {
        recommendations.push("Consider using Next.js for your project to leverage its Image component for optimization")
      }
    }
  
    // Format recommendations
    if (!isUsingNextImage && format !== "webp" && format !== "avif") {
      recommendations.push(`Convert to WebP format to reduce size by ~30%`)
    } else if (isUsingNextImage && format !== "webp" && format !== "avif") {
      recommendations.push(`Next.js Image should be converting this to WebP/AVIF - check your configuration`)
    }
  
    // Size recommendations
    if (size > 1000000) {
      // > 1MB
      recommendations.push(`Compress the image - current size (${Math.round(size / 1024)}KB) is too large`)
    } else if (size > 500000) {
      // > 500KB
      recommendations.push(`Consider further compression - current size (${Math.round(size / 1024)}KB) could be reduced`)
    }
  
    // Dimension recommendations
    if (dimensions) {
      const { width, height } = dimensions
  
      if (width > 2000 || height > 2000) {
        if (!isUsingNextImage) {
          recommendations.push(`Resize image dimensions (${width}×${height}) - current size is excessive for web use`)
        } else {
          recommendations.push(
            `Image dimensions (${width}×${height}) are very large - ensure proper sizing with Next.js Image`,
          )
        }
      } else if (width > 1200 || height > 1200) {
        if (!isUsingNextImage) {
          recommendations.push(
            `Consider using responsive images with multiple sizes for this large image (${width}×${height})`,
          )
        } else {
          recommendations.push(`Use responsive sizing with Next.js Image for this large image (${width}×${height})`)
        }
      }
    }
  
    // Srcset recommendations - Only recommend if truly needed
    if (!srcsetAnalysis || srcsetAnalysis.transformationCount === 0) {
    //   recommendations.push("Add srcset attribute with multiple image sizes for responsive loading")
    } else if (srcsetAnalysis.transformationCount <= 1) {
      // Only recommend more variants if there's just one transformation
      recommendations.push("Add more size variants to your srcset for better responsive coverage")
    } else {
      // For images with 2+ transformations, only make specific recommendations if needed
      if (!srcsetAnalysis.hasMobileSize) {
        recommendations.push("Add smaller image sizes to your srcset for mobile devices")
      }
      if (!srcsetAnalysis.hasDesktopSize) {
        recommendations.push("Add larger image sizes to your srcset for desktop displays")
      }
    }
  
    if (recommendations.length === 0) {
      recommendations.push(`Image appears to be well optimized`)
    }
  
    return recommendations
  }
  