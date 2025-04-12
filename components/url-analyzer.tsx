"use client"

import type React from "react"

import { useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ImageAnalysisResults } from "@/components/image-analysis-results"
import { analyzeUrl } from "@/lib/actions"
import type { ImageAnalysis } from "@/lib/types"

export function UrlAnalyzer() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<ImageAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url) return

    try {
      setIsAnalyzing(true)
      setError(null)
      setResults(null)

      // Validate URL format before sending to server
      try {
        new URL(url)
      } catch (err) {
        throw new Error("Please enter a valid URL including http:// or https://")
      }

      const data = await analyzeUrl(url)

      if (!data) {
        throw new Error("Failed to analyze URL - no data returned")
      }

      if (data.images.length === 0) {
        setError("No images found on this page or unable to analyze images.")
        return
      }

      setResults(data)
    } catch (err) {
      console.error("Error in URL analyzer:", err)
      setError(err instanceof Error ? err.message : "Failed to analyze URL")
      setResults(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <Input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={isAnalyzing || !url}>
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Analyze
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </Card>

      {error && <div className="p-4 border border-red-200 bg-red-50 text-red-800 rounded-md">{error}</div>}

      {results && <ImageAnalysisResults results={results} />}
    </div>
  )
}
