"use server"

import { parse } from "node-html-parser"
import type { ImageAnalysis, ImageInfo } from "./types"
import {
  fetchWithTimeout,
  parseCacheStatus,
} from "@/lib/utils/network"
import {
  getImageFormatFromUrl,
  isNextImageComponent,
  parseSrcSet,
  analyzeSrcSet,
  calculateOptimizationScore,
  generateRecommendations,
} from "@/lib/utils/image"
import {
  initPuppeteer,
  setupPage,
  collectImageNetworkData,
} from "@/lib/utils/puppeteer"

// Import puppeteer and chromium dynamically to avoid issues with SSR
import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium-min"
import sharp from 'sharp';

type ImageData = {
  src: string;
  width: number;
  height: number;
  alt: string;
  loading: string;
  isVisible: boolean;
  isInViewport: boolean;
  attributes: { [key: string]: string };
  isNextImage: boolean;
  srcset: string;
}

export async function analyzeUrl(url: string): Promise<ImageAnalysis> {
  // Check if puppeteer and chromium are available
  const usePuppeteer = !!(puppeteer && chromium)

  try {
    // Validate URL
    const parsedUrl = new URL(url)
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`

    let isLikelyNextJsSite = false
    let imgElements: any[] = []
    let html = ""
    let browser: any = null
    let imageNetworkData = new Map<string, any>()

    try {
      if (usePuppeteer) {
        // Use Puppeteer to render the page with JavaScript
        browser = await initPuppeteer(chromium, puppeteer)
        const page = await browser.newPage()

        // Setup page with realistic settings
        await setupPage(page)

        // Start collecting network data for images
        imageNetworkData = await collectImageNetworkData(page)

        // Navigate to the URL with a timeout
        const startTime = Date.now()
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 30000,
        })
        const loadTime = Date.now() - startTime

        // Wait a bit more for any lazy-loaded images
        await new Promise(r => setTimeout(r, 10000))

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
              srcset: img.srcset || "",
            }
          })
        })

        // Get the HTML content for additional analysis
        html = await page.content()

        // Create a simple structure similar to node-html-parser for compatibility
        imgElements = imageData.map((imgData: ImageData) => ({
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
          _srcset: imgData.srcset,
        }))
      } else {
        // Fallback to the original method if Puppeteer is not available
        console.log("Puppeteer or chromium-min not available, falling back to direct fetch...")
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

        // Get srcset from either Puppeteer data or HTML parsing
        const srcset = img._srcset || img.getAttribute("srcset") || ""

        // Parse and analyze srcset
        const srcsetItems = parseSrcSet(srcset)
        const srcsetAnalysis = analyzeSrcSet(srcsetItems)

        try {
          // Check if we have network data for this image from Puppeteer
          let cacheInfo = undefined
          let responseTime = undefined
          let networkSize = 0

          // Find the network data for this image URL
          const networkEntry = imageNetworkData.get(src)
          if (networkEntry) {
            cacheInfo = parseCacheStatus(new Headers(networkEntry.headers))
            responseTime = networkEntry.responseTime
            networkSize = networkEntry.size || 0
          }

          // Fetch image to analyze if we don't have network data or size is missing
          let buffer: ArrayBuffer | undefined
          let size = networkSize
          let contentType: string | null = null

          if (!size) {
            const imgResponse = await fetchWithTimeout(
              src,
              {
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; ImageOptimizer/1.0; +https://example.com)",
                },
              },
              5000,
            )

            if (!imgResponse.ok) {
              return null
            }

            buffer = await imgResponse.arrayBuffer()
            size = buffer.byteLength
            contentType = imgResponse.headers.get("content-type")

            // If we didn't get cache info from Puppeteer, try to get it from this fetch
            if (!cacheInfo) {
              cacheInfo = parseCacheStatus(imgResponse.headers)
            }
          }

          // If this is the largest image so far, mark as potential LCP
          if (size > largestImage.size) {
            largestImage = { src, size }
          }

          // Get image format from content-type or URL
          let format = getImageFormatFromUrl(src, contentType || networkEntry?.contentType)

          // Use dimensions from Puppeteer if available, otherwise try to get them
          let dimensions = img._dimensions || undefined

          // Try to get dimensions using sharp if not available from Puppeteer
          if (!dimensions && sharp && format !== "svg" && buffer) {
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
          const optimizationScore = calculateOptimizationScore(
            format,
            size,
            dimensions,
            isUsingNextImage,
            srcsetAnalysis,
            cacheInfo,
          )

          // Generate recommendations based on whether it's using Next.js Image or not
          const recommendations = generateRecommendations(
            format,
            size,
            dimensions,
            isUsingNextImage,
            isLikelyNextJsSite,
            srcsetAnalysis,
            cacheInfo,
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
            srcset,
            srcsetAnalysis,
            cacheInfo,
            responseTime,
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

      // Calculate total transformations from srcset analysis
      const totalTransformations = processedImages.reduce((sum, img) => {
        return sum + (img.srcsetAnalysis?.transformationCount || 0)
      }, 0)

      // Calculate percentage of cached images
      const cachedImages = processedImages.filter((img) => img.cacheInfo?.cacheHit).length
      const cachedImagesPercentage = processedImages.length > 0 ? (cachedImages / processedImages.length) * 100 : 0

      return {
        url,
        images: processedImages,
        totalSize,
        potentialSavings,
        potentialSavingsPercentage: totalSize > 0 ? (potentialSavings / totalSize) * 100 : 0,
        isLikelyNextJsSite,
        renderedWithPuppeteer: usePuppeteer,
        totalTransformations,
        cachedImagesPercentage,
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
