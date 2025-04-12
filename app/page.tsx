import { UrlAnalyzer } from "@/components/url-analyzer"

export const maxDuration = 300;

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-24 max-w-5xl mx-auto">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Image Optimization Analyzer</h1>
          <p className="text-muted-foreground">
            Enter a URL to analyze images and get optimization recommendations for your Next.js application.
          </p>
        </div>
        <UrlAnalyzer />
      </div>
    </main>
  )
}
