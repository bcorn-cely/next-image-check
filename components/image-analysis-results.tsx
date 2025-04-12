"use client"

import {
  CheckIcon as ImageCheck,
  AlertTriangle,
  FileWarning,
  ArrowDownToLine,
  Scale,
  Monitor,
  Link,
  Copy,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ImageAnalysis, ImageInfo } from "@/lib/types"
import { formatBytes } from "@/lib/utils"
import { useState } from "react"

export function ImageAnalysisResults({ results }: { results: ImageAnalysis }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
            <CardDescription>
              Found {results.images.length} images on {results.url}
              {results.isLikelyNextJsSite && " (Detected as a Next.js site)"}
              {results.renderedWithPuppeteer && " (Rendered with Chromium)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Total image weight: {formatBytes(results.totalSize)}</div>
                  <div className="text-sm text-muted-foreground">
                    Potential savings: {formatBytes(results.potentialSavings)}
                  </div>
                </div>
                <Progress value={results.potentialSavingsPercentage} className="h-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-green-100 bg-green-50">
                  <div className="flex items-center gap-2">
                    <ImageCheck className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Optimized</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {results.images.filter((img) => img.optimizationScore >= 80).length}
                  </div>
                </Card>

                <Card className="p-4 border-yellow-100 bg-yellow-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">Needs Improvement</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {results.images.filter((img) => img.optimizationScore >= 50 && img.optimizationScore < 80).length}
                  </div>
                </Card>

                <Card className="p-4 border-red-100 bg-red-50">
                  <div className="flex items-center gap-2">
                    <FileWarning className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Critical</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {results.images.filter((img) => img.optimizationScore < 50).length}
                  </div>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Image Recommendations</h2>

        {results.images.map((image, index) => (
          <ImageCard key={index} image={image} />
        ))}
      </div>

      {results.isLikelyNextJsSite && (
        <Card>
          <CardHeader>
            <CardTitle>Next.js Best Practices</CardTitle>
            <CardDescription>Recommendations for implementing images in your Next.js application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Use the Next.js Image Component</h3>
              <p className="text-sm text-muted-foreground">
                Replace standard HTML <code className="bg-muted px-1 py-0.5 rounded">&lt;img&gt;</code> tags with the
                Next.js <code className="bg-muted px-1 py-0.5 rounded">&lt;Image&gt;</code> component for automatic
                optimization [^2][^3].
              </p>
              <div className="bg-muted p-3 rounded-md text-sm">
                <pre>{`import Image from 'next/image'

export default function Page() {
  return (
    <Image
      src="/path/to/image.jpg"
      alt="Description"
      width={500}
      height={300}
      priority={false}
    />
  )
}`}</pre>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Implement Responsive Images</h3>
              <p className="text-sm text-muted-foreground">
                Use responsive sizing to serve appropriately sized images for different devices [^2][^4].
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Prioritize LCP Images</h3>
              <p className="text-sm text-muted-foreground">
                Add the <code className="bg-muted px-1 py-0.5 rounded">priority</code> property to images that will be
                the Largest Contentful Paint (LCP) element [^2][^5].
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Configure Remote Domains</h3>
              <p className="text-sm text-muted-foreground">
                For remote images, configure allowed domains in your{" "}
                <code className="bg-muted px-1 py-0.5 rounded">next.config.js</code> file [^2][^5].
              </p>
              <div className="bg-muted p-3 rounded-md text-sm">
                <pre>{`// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
        pathname: '/images/**',
      },
    ],
  },
}`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ImageCard({ image }: { image: ImageInfo }) {
  const [showFullUrl, setShowFullUrl] = useState(false)

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 50) return "text-yellow-600"
    return "text-red-600"
  }

  // Function to truncate URL for display
  const truncateUrl = (url: string, maxLength = 50) => {
    if (url.length <= maxLength) return url

    // Extract domain from URL
    let domain = ""
    try {
      domain = new URL(url).hostname
    } catch (e) {
      // If URL parsing fails, just use simple truncation
      return url.substring(0, maxLength - 3) + "..."
    }

    // If the URL is very long, show domain + beginning and end
    const urlWithoutProtocol = url.replace(/^https?:\/\//, "")
    if (urlWithoutProtocol.length > maxLength) {
      return domain + "/..." + urlWithoutProtocol.slice(-20)
    }

    return url
  }

  // Function to copy URL to clipboard
  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(image.src)
      .then(() => {
        alert("URL copied to clipboard!")
      })
      .catch((err) => {
        console.error("Failed to copy URL: ", err)
      })
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid md:grid-cols-[1fr_2fr] gap-6">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-full aspect-square max-w-[200px] bg-muted rounded-md overflow-hidden">
              {image.src && (
                <div className="w-full h-full bg-center bg-cover" style={{ backgroundImage: `url(${image.src})` }} />
              )}
              {image.isInViewport && (
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Monitor className="h-3 w-3" />
                    Viewport
                  </Badge>
                </div>
              )}
            </div>
            <div className="mt-4 text-center">
              <div className={`text-2xl font-bold ${getScoreColor(image.optimizationScore)}`}>
                {image.optimizationScore}/100
              </div>
              <div className="text-sm text-muted-foreground">Optimization Score</div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Improved URL display */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <h3 className="font-medium">Image URL</h3>
              </div>

              <div className="bg-muted rounded-md p-2 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className={`text-xs text-muted-foreground break-all ${showFullUrl ? "" : "line-clamp-1"}`}>
                    {image.src}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowFullUrl(!showFullUrl)}
                  >
                    {showFullUrl ? "Show Less" : "Show Full URL"}
                  </Button>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={copyToClipboard}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy URL</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => window.open(image.src, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open in new tab</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Scale className="h-3 w-3" />
                {formatBytes(image.size)}
              </Badge>
              {image.format && <Badge variant="outline">{image.format.toUpperCase()}</Badge>}
              {image.dimensions && (
                <Badge variant="outline">
                  {image.dimensions.width}×{image.dimensions.height}
                </Badge>
              )}
              {image.isLCP && <Badge variant="destructive">LCP Element</Badge>}
              {image.isUsingNextImage && <Badge variant="secondary">Next.js Image</Badge>}
              {image.isVisible === false && (
                <Badge variant="outline" className="bg-gray-100">
                  Hidden
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Recommendations</h4>
              <ul className="space-y-1 text-sm">
                {image.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <ArrowDownToLine className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!image.isUsingNextImage && (
              <div className="pt-2">
                <h4 className="font-medium mb-2">Implementation Example</h4>
                <div className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                  <pre>{`<Image
  src="${image.src}"
  alt="Description"
  width={${image.dimensions?.width || "width"}}
  height={${image.dimensions?.height || "height"}}
  ${image.isLCP ? "priority" : ""}
/>`}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
