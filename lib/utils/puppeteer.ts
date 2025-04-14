const isLocal = process.env.NODE_ENV === 'development';

const execPath = isLocal ?
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : 
  'https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar';

// Initialize Puppeteer with chromium-min
export async function initPuppeteer(chromium: any, puppeteer: any): Promise<any> {
  console.log("Launching Puppeteer browser with chromium-min...")

  // Get the executable path from chromium-min
  const executablePath = isLocal ? execPath : await chromium.executablePath(execPath)

  // Launch browser with the chromium-min executable path
  const browser = await puppeteer.launch({
    headless: "new", // Use new headless mode
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process"],
    ignoreHTTPSErrors: true,
  })

  return browser
}

// Setup page with realistic browser settings
export async function setupPage(page: any): Promise<void> {
  // Set a realistic viewport
  await page.setViewport({ width: 1280, height: 800 })

  // Set a realistic user agent
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  )
}

// Collect image network data including headers
export async function collectImageNetworkData(page: any): Promise<Map<string, any>> {
  const imageData = new Map<string, any>()

  // Start monitoring network requests
  await page.setRequestInterception(true)

  page.on("request", (request: any) => {
    // Don't block requests, just monitor them
    request.continue()
  })

  page.on("response", async (response: any) => {
    const url = response.url()
    const contentType = response.headers()["content-type"] || ""

    // Only process image responses
    if (contentType.startsWith("image/") || url.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i)) {
      try {
        const headers = response.headers()

        imageData.set(url, {
          status: response.status(),
          headers,
          contentType,
          size: Number.parseInt(headers["content-length"] || "0", 10),
        })
      } catch (error) {
        console.error(`Error processing response for ${url}:`, error)
      }
    }
  })

  return imageData
}
