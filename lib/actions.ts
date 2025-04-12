"use server"

import { parse } from "node-html-parser"
import type { ImageAnalysis, ImageInfo } from "./types"
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import chromium from '@sparticuz/chromium-min';

const isLocal = process.env.NODE_ENV === 'development';

const execPath = isLocal ?
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : 
  'https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
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

// Function to get image type from URL or content-type
function getImageFormatFromUrl(url: string, contentType?: string): string {
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
function isNextImageComponent(imgElement: any): boolean {
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

export async function analyzeUrl(url: string): Promise<ImageAnalysis> {
  // Check if puppeteer is available
  const usePuppeteer = !!puppeteer

  try {
    // Validate URL
    const parsedUrl = new URL(url)
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`

    let isLikelyNextJsSite = false
    let imgElements: any[] = []
    let html = ""
    let browser: any = null

    const path = isLocal ? 
      execPath : await chromium.executablePath(execPath);

    try {
      if (usePuppeteer) {
        // Use Puppeteer to render the page with JavaScript
        console.log("Launching Puppeteer browser...")
        browser = await puppeteer.launch({
          headless: true, // Use new headless mode
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
          executablePath: path
        })

        const page = await browser.newPage()

        // Set a realistic viewport
        await page.setViewport({ width: 1280, height: 800 })

        // Set a realistic user agent
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        )

        // Navigate to the URL with a timeout
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 20000,
        })

        // Wait a bit more for any lazy-loaded images
        await new Promise(r => setTimeout(r, 2000))

        // Check if this is likely a Next.js site
        isLikelyNextJsSite = await page.evaluate(() => {
          return (
            document.querySelector("[data-nimg]") !== null ||
            document.querySelector("script#__NEXT_DATA__") !== null ||
            document.querySelector('link[href*="/_next/"]') !== null
          )
        })

        // Get all image elements and their properties
        const imageData = await page.evaluate(() => {
          const images = Array.from(document.querySelectorAll("img"))
          return images.map((img) => {
            // Get computed styles to check visibility
            const style = window.getComputedStyle(img)
            const isVisible = style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0"

            // Get position information
            const rect = img.getBoundingClientRect()
            const isInViewport = rect.top < window.innerHeight && rect.bottom > 0

            // Get all attributes
            const attributes: Record<string, string> = {}
            Array.from(img.attributes).forEach((attr) => {
              attributes[attr.name] = attr.value
            })

            // Check if it's a Next.js image
            const isNextImage =
              img.hasAttribute("data-nimg") ||
              (img.srcset && img.srcset.includes("/_next/image")) ||
              (img.parentElement?.tagName === "SPAN" &&
                img.parentElement?.style.boxSizing === "border-box" &&
                img.parentElement?.style.display === "inline-block")

            return {
              src: img.currentSrc || img.src,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              alt: img.alt,
              loading: img.loading,
              isVisible,
              isInViewport,
              attributes,
              isNextImage,
            }
          })
        })
        console.log('imageData ', imageData);
        // Get the HTML content for additional analysis
        html = await page.content()

        // Create a simple structure similar to node-html-parser for compatibility
        imgElements = imageData.map((imgData: any) => ({
          getAttribute: (name: string) => imgData.attributes[name] || null,
          hasAttribute: (name: string) => imgData.attributes.hasOwnProperty(name),
          parentNode: null, // We already checked for Next.js image in the browser
          tagName: "IMG",
          _isNextImage: imgData.isNextImage,
          _dimensions: {
            width: imgData.width,
            height: imgData.height,
          },
          _src: imgData.src,
          _isVisible: imgData.isVisible,
          _isInViewport: imgData.isInViewport,
        }))
      } else {
        // Fallback to the original method if Puppeteer is not available
        console.log("Puppeteer not available, falling back to direct fetch...")
        const response = await fetchWithTimeout(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ImageOptimizer/1.0; +https://example.com)",
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
        }

        html = await response.text()
        isLikelyNextJsSite = html.includes("__NEXT_DATA__") || html.includes("/_next/") || html.includes("data-nimg")

        // Parse HTML to extract images
        const root = parse(html)
        imgElements = root.querySelectorAll("img")
      }

      // Track LCP candidates (usually the largest image in the viewport)
      let largestImage = { src: "", size: 0 }

      // Process each image
      const imagePromises = imgElements.map(async (img) => {
        // Get the source from either Puppeteer data or HTML parsing
        let src = img._src || img.getAttribute("src") || ""

        // Skip data URLs, empty sources, and base64 images
        if (!src || src.startsWith("data:") || src.includes(";base64,")) {
          return null
        }

        // Handle relative URLs
        if (src.startsWith("/")) {
          src = `${baseUrl}${src}`
        } else if (!src.startsWith("http")) {
          src = `${baseUrl}/${src}`
        }

        // Check if this image is using Next.js Image component
        // For Puppeteer results, we already have this information
        const isUsingNextImage = img._isNextImage !== undefined ? img._isNextImage : isNextImageComponent(img)

        try {
          // Fetch image to analyze
          const imgResponse = await fetchWithTimeout(
            src,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ImageOptimizer/1.0; +https://example.com)",
              },
            },
            5000,
          ) // Shorter timeout for images

          if (!imgResponse.ok) {
            return null
          }

          const buffer = await imgResponse.arrayBuffer()
          const size = buffer.byteLength

          // If this is the largest image so far, mark as potential LCP
          if (size > largestImage.size) {
            largestImage = { src, size }
          }

          // Get image format from content-type or URL
          const contentType = imgResponse.headers.get("content-type") || "";

          if (!contentType) {
            console.error('Could not get content type');
          }
          let format = getImageFormatFromUrl(src, contentType)

          // Use dimensions from Puppeteer if available, otherwise try to get them
          let dimensions = img._dimensions || undefined

          // Try to get dimensions using sharp if not available from Puppeteer
          if (!dimensions && sharp && format !== "svg") {
            try {
              const metadata = await sharp(Buffer.from(buffer)).metadata()
              format = metadata.format || format

              if (metadata.width && metadata.height) {
                dimensions = {
                  width: metadata.width,
                  height: metadata.height,
                }
              }
            } catch (err) {
              console.error("Error analyzing image with sharp:", src, err)
              // Continue with what we have
            }
          }

          // If we still don't have dimensions, try to get them from HTML attributes
          if (!dimensions) {
            const width = Number.parseInt(img.getAttribute("width") || "0", 10)
            const height = Number.parseInt(img.getAttribute("height") || "0", 10)

            if (width > 0 && height > 0) {
              dimensions = { width, height }
            }
          }

          // Calculate optimization score based on various factors
          const optimizationScore = calculateOptimizationScore(format, size, dimensions, isUsingNextImage)

          // Generate recommendations based on whether it's using Next.js Image or not
          const recommendations = generateRecommendations(
            format,
            size,
            dimensions,
            isUsingNextImage,
            isLikelyNextJsSite,
          )

          // Determine if image is in viewport (for LCP calculation)
          const isInViewport = img._isInViewport !== undefined ? img._isInViewport : true
          const isVisible = img._isVisible !== undefined ? img._isVisible : true

          return {
            src,
            size,
            format,
            dimensions,
            optimizationScore,
            isLCP: false, // Will update after processing all images
            isUsingNextImage,
            isInViewport,
            isVisible,
            recommendations,
          }
        } catch (err) {
          console.error("Error processing image:", src, err)
          return null
        }
      })

      // Wait for all image processing to complete
      const processedImages = (await Promise.all(imagePromises)).filter(Boolean) as ImageInfo[]

      // Mark the largest visible image in viewport as LCP
      const visibleViewportImages = processedImages.filter((img) => img.isVisible && img.isInViewport)

      if (visibleViewportImages.length > 0) {
        // Find the largest visible image in viewport
        const largestViewportImage = visibleViewportImages.reduce((largest, current) => {
          return current.size > largest.size ? current : largest
        }, visibleViewportImages[0])

        // Mark it as LCP
        processedImages.forEach((img) => {
          if (img.src === largestViewportImage.src) {
            img.isLCP = true

            // If this is an LCP image and not using Next.js Image, add a specific recommendation
            if (!img.isUsingNextImage && isLikelyNextJsSite) {
              img.recommendations.unshift(
                "This is an LCP element - use the Next.js Image component with priority attribute",
              )
            }
          }
        })
      } else {
        // Fallback to the original method if no visible viewport images
        processedImages.forEach((img) => {
          if (img.src === largestImage.src) {
            img.isLCP = true

            if (!img.isUsingNextImage && isLikelyNextJsSite) {
              img.recommendations.unshift(
                "This is an LCP element - use the Next.js Image component with priority attribute",
              )
            }
          }
        })
      }

      // Calculate totals
      const totalSize = processedImages.reduce((sum, img) => sum + img.size, 0)
      const potentialSavings = processedImages.reduce((sum, img) => {
        // Estimate potential savings based on score
        const savingsPercentage = img.optimizationScore < 80 ? (80 - img.optimizationScore) / 100 : 0
        return sum + img.size * savingsPercentage
      }, 0)

      return {
        url,
        images: processedImages,
        totalSize,
        potentialSavings,
        potentialSavingsPercentage: totalSize > 0 ? (potentialSavings / totalSize) * 100 : 0,
        isLikelyNextJsSite,
        renderedWithPuppeteer: usePuppeteer,
      }
    } finally {
      // Make sure to close the browser if it was opened
      if (browser) {
        await browser.close()
        console.log("Puppeteer browser closed")
      }
    }
  } catch (error) {
    console.error("Error analyzing URL:", error)
    throw new Error(`Failed to analyze the provided URL: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

function calculateOptimizationScore(
  format: string,
  size: number,
  dimensions?: { width: number; height: number },
  isUsingNextImage = false,
): number {
  let score = 100

  // Format-based scoring
  if (format === "webp" || format === "avif") {
    // Modern formats are good
    score -= 0
  } else if (format === "png") {
    // PNG is often larger than necessary for photos
    score -= 20
  } else if (format === "jpeg" || format === "jpg") {
    // JPEG is common but not as efficient as WebP
    score -= 15
  } else if (format === "gif") {
    // GIF is often inefficient
    score -= 30
  } else {
    // Unknown or other formats
    score -= 10
  }

  // Size-based scoring
  if (size > 1000000) {
    // > 1MB
    score -= 30
  } else if (size > 500000) {
    // > 500KB
    score -= 20
  } else if (size > 200000) {
    // > 200KB
    score -= 10
  } else if (size > 100000) {
    // > 100KB
    score -= 5
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

  // Bonus for using Next.js Image
  if (isUsingNextImage) {
    score += 15
  }

  // Ensure score is within 0-100 range
  return Math.max(0, Math.min(100, score))
}

function generateRecommendations(
  format: string,
  size: number,
  dimensions?: { width: number; height: number },
  isUsingNextImage = false,
  isLikelyNextJsSite = false,
): string[] {
  const recommendations: string[] = []

  // Next.js Image component recommendations
  if (!isUsingNextImage) {
    if (isLikelyNextJsSite) {
      recommendations.push("Replace standard <img> tag with Next.js Image component for automatic optimization")
    } else {
      recommendations.push("Consider using Next.js for your project to leverage its Image component for optimization")
    }
  } else {
    recommendations.push("Already using Next.js Image component - good practice!")
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

  if (recommendations.length === 0) {
    recommendations.push(`Image appears to be well optimized`)
  }

  return recommendations
}
