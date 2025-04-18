"use client"

import {
  CheckIcon as ImageCheck,
  AlertTriangle,
  FileWarning,
  ArrowDownToLine,
  Scale,
  Copy,
  ExternalLink,
  Layers,
  Server,
  Clock,
  Filter,
  SlidersHorizontal,
  Search,
  ChevronRight,
  SortAsc,
  SortDesc,
  Eye,
  EyeOff,
  ImageIcon,
  Database,
  Globe,
  Cloud,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import type { ImageAnalysis, ImageInfo } from "@/lib/types"
import { formatBytes, truncateUrl } from "@/lib/utils/format"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

function getProviderDistribution(images: ImageInfo[]): { provider: string; count: number }[] {
  const providerCounts: Record<string, number> = {}

  images.forEach((image) => {
    if (image.serverInfo?.provider) {
      const provider = image.serverInfo.provider
      providerCounts[provider] = (providerCounts[provider] || 0) + 1
    }
  })

  return Object.entries(providerCounts)
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count)
}

export function ImageAnalysisResults({ results }: { results: ImageAnalysis }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<{
    score: string[]
    format: string[]
    size: string[]
    status: string[]
    provider: string[]
  }>({
    score: [],
    format: [],
    size: [],
    status: [],
    provider: [],
  })
  const [sortBy, setSortBy] = useState<{ field: string; direction: "asc" | "desc" }>({
    field: "optimizationScore",
    direction: "desc",
  })
  const [expandedImageIds, setExpandedImageIds] = useState<Set<string>>(new Set())

  // Extract all available formats from images
  const availableFormats = useMemo(() => {
    const formats = new Set<string>()
    results.images.forEach((img) => {
      if (img.format) formats.add(img.format.toUpperCase())
    })
    return Array.from(formats)
  }, [results.images])

  // Extract all available providers from images
  const availableProviders = useMemo(() => {
    const providers = new Set<string>()
    results.images.forEach((img) => {
      if (img.serverInfo?.provider) providers.add(img.serverInfo.provider)
    })
    return Array.from(providers)
  }, [results.images])

  // Filter images based on search and filters
  const filteredImages = useMemo(() => {
    return results.images
      .filter((image) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          if (!image.src.toLowerCase().includes(query)) {
            return false
          }
        }

        // Score filter
        if (selectedFilters.score.length > 0) {
          const score = image.optimizationScore
          if (
            (selectedFilters.score.includes("good") && score < 80) ||
            (selectedFilters.score.includes("medium") && (score < 50 || score >= 80)) ||
            (selectedFilters.score.includes("poor") && score >= 50)
          ) {
            return false
          }
        }

        // Format filter
        if (selectedFilters.format.length > 0 && image.format) {
          if (!selectedFilters.format.includes(image.format.toUpperCase())) {
            return false
          }
        }

        // Size filter
        if (selectedFilters.size.length > 0) {
          const size = image.size
          if (
            (selectedFilters.size.includes("small") && size > 100000) ||
            (selectedFilters.size.includes("medium") && (size <= 100000 || size > 500000)) ||
            (selectedFilters.size.includes("large") && size <= 500000)
          ) {
            return false
          }
        }

        // Status filter
        if (selectedFilters.status.length > 0) {
          if (
            (selectedFilters.status.includes("lcp") && !image.isLCP) ||
            (selectedFilters.status.includes("nextImage") && !image.isUsingNextImage) ||
            (selectedFilters.status.includes("viewport") && !image.isInViewport) ||
            (selectedFilters.status.includes("cached") && (!image.cacheInfo || !image.cacheInfo.cacheHit))
          ) {
            return false
          }
        }

        // Provider filter
        if (selectedFilters.provider.length > 0) {
          if (!image.serverInfo?.provider || !selectedFilters.provider.includes(image.serverInfo.provider)) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        // Sort based on selected field and direction
        const field = sortBy.field
        const direction = sortBy.direction === "asc" ? 1 : -1

        if (field === "optimizationScore") {
          return direction * (a.optimizationScore - b.optimizationScore)
        } else if (field === "size") {
          return direction * (a.size - b.size)
        } else if (field === "format") {
          return direction * (a.format || "").localeCompare(b.format || "")
        }

        return 0
      })
  }, [results.images, searchQuery, selectedFilters, sortBy])

  // Toggle filter selection
  const toggleFilter = (category: keyof typeof selectedFilters, value: string) => {
    setSelectedFilters((prev) => {
      const newFilters = { ...prev }
      if (newFilters[category].includes(value)) {
        newFilters[category] = newFilters[category].filter((v) => v !== value)
      } else {
        newFilters[category] = [...newFilters[category], value]
      }
      return newFilters
    })
  }

  // Toggle image expansion
  const toggleImageExpansion = (imageId: string) => {
    setExpandedImageIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(imageId)) {
        newSet.delete(imageId)
      } else {
        newSet.add(imageId)
      }
      return newSet
    })
  }

  // Clear all filters
  const clearFilters = () => {
    setSelectedFilters({
      score: [],
      format: [],
      size: [],
      status: [],
      provider: [],
    })
    setSearchQuery("")
  }

  // Set sort
  const setSort = (field: string) => {
    setSortBy((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { field, direction: "desc" }
    })
  }

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

              {/* Provider Distribution */}
              {results.images.some((img) => img.serverInfo?.provider) && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Image Providers</span>
                  </div>
                  <div className="space-y-2">
                    {getProviderDistribution(results.images).map(({ provider, count }) => (
                      <div key={provider} className="flex justify-between items-center">
                        <span className="text-sm">{provider}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{count}</span>
                          <span className="text-xs text-muted-foreground">
                            ({Math.round((count / results.images.length) * 100)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Image Transformations</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">{results.totalTransformations || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total variants in srcset attributes</div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Cache Hit Rate</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {results.cachedImagesPercentage !== undefined
                      ? `${Math.round(results.cachedImagesPercentage)}%`
                      : "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Images served from cache</div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Responsive Images</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">{results.images.filter((img) => img.srcset).length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Images with srcset attribute</div>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <h2 className="text-xl font-bold">Image Recommendations</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search images..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                  {Object.values(selectedFilters).some((arr) => arr.length > 0) && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {Object.values(selectedFilters).reduce((sum, arr) => sum + arr.length, 0)}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Score</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.score.includes("good")}
                  onCheckedChange={() => toggleFilter("score", "good")}
                >
                  <span className="text-green-600 font-medium">Good (80-100)</span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.score.includes("medium")}
                  onCheckedChange={() => toggleFilter("score", "medium")}
                >
                  <span className="text-yellow-600 font-medium">Medium (50-79)</span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.score.includes("poor")}
                  onCheckedChange={() => toggleFilter("score", "poor")}
                >
                  <span className="text-red-600 font-medium">Poor (0-49)</span>
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Filter by Format</DropdownMenuLabel>
                {availableFormats.map((format) => (
                  <DropdownMenuCheckboxItem
                    key={format}
                    checked={selectedFilters.format.includes(format)}
                    onCheckedChange={() => toggleFilter("format", format)}
                  >
                    {format}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Filter by Size</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.size.includes("small")}
                  onCheckedChange={() => toggleFilter("size", "small")}
                >
                  Small (&lt; 100KB)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.size.includes("medium")}
                  onCheckedChange={() => toggleFilter("size", "medium")}
                >
                  Medium (100KB - 500KB)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.size.includes("large")}
                  onCheckedChange={() => toggleFilter("size", "large")}
                >
                  Large (&gt; 500KB)
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.status.includes("lcp")}
                  onCheckedChange={() => toggleFilter("status", "lcp")}
                >
                  LCP Elements
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.status.includes("nextImage")}
                  onCheckedChange={() => toggleFilter("status", "nextImage")}
                >
                  Next.js Images
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.status.includes("viewport")}
                  onCheckedChange={() => toggleFilter("status", "viewport")}
                >
                  In Viewport
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedFilters.status.includes("cached")}
                  onCheckedChange={() => toggleFilter("status", "cached")}
                >
                  Cached Images
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Filter by Provider</DropdownMenuLabel>
                {availableProviders.map((provider) => (
                  <DropdownMenuCheckboxItem
                    key={provider}
                    checked={selectedFilters.provider.includes(provider)}
                    onCheckedChange={() => toggleFilter("provider", provider)}
                  >
                    {provider}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={sortBy.field === "optimizationScore"}
                  onCheckedChange={() => setSort("optimizationScore")}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Optimization Score</span>
                    {sortBy.field === "optimizationScore" &&
                      (sortBy.direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />)}
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={sortBy.field === "size"} onCheckedChange={() => setSort("size")}>
                  <div className="flex items-center justify-between w-full">
                    <span>Size</span>
                    {sortBy.field === "size" &&
                      (sortBy.direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />)}
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={sortBy.field === "format"} onCheckedChange={() => setSort("format")}>
                  <div className="flex items-center justify-between w-full">
                    <span>Format</span>
                    {sortBy.field === "format" &&
                      (sortBy.direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />)}
                  </div>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredImages.length} of {results.images.length} images
          {Object.values(selectedFilters).some((arr) => arr.length > 0) && " (filtered)"}
        </div>

        {/* Compact image list */}
        <div className="space-y-2">
          {filteredImages.length === 0 ? (
            <Card className="p-6 text-center">
              <div className="flex flex-col items-center justify-center gap-2">
                <ImageIcon className="h-12 w-12 text-muted-foreground opacity-20" />
                <h3 className="font-medium text-lg">No images match your filters</h3>
                <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                  Clear All Filters
                </Button>
              </div>
            </Card>
          ) : (
            filteredImages.map((image, index) => (
              <CompactImageCard
                key={index}
                image={image}
                isExpanded={expandedImageIds.has(image.src)}
                onToggleExpand={() => toggleImageExpansion(image.src)}
              />
            ))
          )}
        </div>
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
                optimization.
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
                Use responsive sizing to serve appropriately sized images for different devices.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Prioritize LCP Images</h3>
              <p className="text-sm text-muted-foreground">
                Add the <code className="bg-muted px-1 py-0.5 rounded">priority</code> property to images that will be
                the Largest Contentful Paint (LCP) element.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Configure Remote Domains</h3>
              <p className="text-sm text-muted-foreground">
                For remote images, configure allowed domains in your{" "}
                <code className="bg-muted px-1 py-0.5 rounded">next.config.js</code> file.
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

function CompactImageCard({
  image,
  isExpanded,
  onToggleExpand,
}: {
  image: ImageInfo
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 50) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-50 border-green-100"
    if (score >= 50) return "bg-yellow-50 border-yellow-100"
    return "bg-red-50 border-red-100"
  }

  // Function to copy URL to clipboard
  const copyToClipboard = (text: string, message = "URL copied to clipboard!") => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert(message)
      })
      .catch((err) => {
        console.error("Failed to copy:", err)
      })
  }

  return (
    <Card className={`overflow-hidden transition-all duration-200 ${isExpanded ? "border-primary" : ""}`}>
      <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggleExpand}>
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="relative h-16 w-16 flex-shrink-0 bg-muted rounded overflow-hidden">
            {image.src && (
              <div className="w-full h-full bg-center bg-cover" style={{ backgroundImage: `url(${image.src})` }} />
            )}
          </div>

          {/* Basic info */}
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium truncate">{truncateUrl(image.src, 40)}</div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Scale className="h-3 w-3" />
                {formatBytes(image.size)}
              </Badge>
              {image.format && (
                <Badge variant="outline" className="text-xs">
                  {image.format.toUpperCase()}
                </Badge>
              )}
              {image.dimensions && (
                <Badge variant="outline" className="text-xs">
                  {image.dimensions.width}×{image.dimensions.height}
                </Badge>
              )}
              {image.isLCP && (
                <Badge variant="destructive" className="text-xs">
                  LCP
                </Badge>
              )}
              {image.isUsingNextImage && (
                <Badge variant="secondary" className="text-xs">
                  Next.js
                </Badge>
              )}
              {image.isInViewport && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Eye className="h-3 w-3" />
                  Viewport
                </Badge>
              )}
              {image.isVisible === false && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs bg-gray-100">
                  <EyeOff className="h-3 w-3" />
                  Hidden
                </Badge>
              )}
              {image.serverInfo?.provider && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Database className="h-3 w-3" />
                  {image.serverInfo.provider}
                </Badge>
              )}
            </div>
          </div>

          {/* Score */}
          <div
            className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center ${getScoreBgColor(image.optimizationScore)} border`}
          >
            <div className={`text-lg font-bold ${getScoreColor(image.optimizationScore)}`}>
              {image.optimizationScore}
            </div>
          </div>

          {/* Expand/collapse indicator */}
          <ChevronRight
            className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t p-4 bg-muted/10">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="recommendations" className="border-none">
              <AccordionTrigger className="py-2 hover:no-underline">
                <h4 className="text-sm font-medium">Recommendations</h4>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1 text-sm">
                  {image.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ArrowDownToLine className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            {image.srcset && (
              <AccordionItem value="srcset" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <h4 className="text-sm font-medium">Responsive Variants</h4>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <div className="mb-3">
                      <span className="font-semibold">Transformations:</span>{" "}
                      {image.srcsetAnalysis?.transformationCount || 0}
                      {image.srcsetAnalysis?.sizeRange && (
                        <span className="ml-3">
                          <span className="font-semibold">Size Range:</span> {image.srcsetAnalysis.sizeRange.min}w -{" "}
                          {image.srcsetAnalysis.sizeRange.max}w
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="font-semibold">srcset:</div>
                      <div className="bg-slate-100 rounded-md p-2">
                        <div className="text-xs text-muted-foreground break-all">{image.srcset}</div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs mt-2"
                          onClick={() => image.srcset && copyToClipboard(image.srcset, "srcset copied to clipboard!")}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {image.cacheInfo && (
              <AccordionItem value="cache" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <h4 className="text-sm font-medium">Cache Information</h4>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <div className="mb-1">
                      <span className="font-semibold">Status:</span>{" "}
                      <span className={image.cacheInfo.cacheHit ? "text-green-600" : "text-yellow-600"}>
                        {image.cacheInfo.cacheHit ? "HIT" : "MISS"}
                      </span>
                    </div>
                    {image.cacheInfo.cacheProvider && (
                      <div className="mb-1">
                        <span className="font-semibold">Provider:</span> {image.cacheInfo.cacheProvider}
                      </div>
                    )}
                    {image.cacheInfo.ttl !== undefined && (
                      <div className="mb-1">
                        <span className="font-semibold">TTL:</span> {image.cacheInfo.ttl} seconds
                      </div>
                    )}
                    {image.cacheInfo.cacheControl && (
                      <div className="text-xs line-clamp-2">
                        <span className="font-semibold">Cache-Control:</span> {image.cacheInfo.cacheControl}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {image.serverInfo && (
              <AccordionItem value="server" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <h4 className="text-sm font-medium">Server Information</h4>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-3 rounded-md text-sm">
                    {image.serverInfo.provider && (
                      <div className="mb-1">
                        <span className="font-semibold">Provider:</span>{" "}
                        <span className="flex items-center gap-1">
                          <Cloud className="h-3.5 w-3.5" />
                          {image.serverInfo.provider}
                        </span>
                      </div>
                    )}
                    {image.serverInfo.server && (
                      <div className="mb-1">
                        <span className="font-semibold">Server:</span>{" "}
                        <span className="flex items-center gap-1">
                          <Server className="h-3.5 w-3.5" />
                          {image.serverInfo.server}
                        </span>
                      </div>
                    )}
                    {image.serverInfo.location && (
                      <div className="mb-1">
                        <span className="font-semibold">Location:</span>{" "}
                        <span className="flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" />
                          {image.serverInfo.location}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {!image.isUsingNextImage && (
              <AccordionItem value="implementation" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <h4 className="text-sm font-medium">Implementation Example</h4>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                    <pre>{`<Image
  src="${image.src}"
  alt="Description"
  width={${image.dimensions?.width || "width"}}
  height={${image.dimensions?.height || "height"}}
  ${image.isLCP ? "priority" : ""}
/>`}</pre>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => copyToClipboard(image.src)}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy URL
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => window.open(image.src, "_blank")}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Image
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
