import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const parseArgs = (argv) => {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i]
    if (!raw.startsWith('--')) continue
    const [key, inline] = raw.slice(2).split('=', 2)
    if (inline !== undefined) {
      args[key] = inline
      continue
    }
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = 'true'
      continue
    }
    args[key] = next
    i += 1
  }
  return args
}

const toBool = (value) => value === true || value === 'true' || value === '1' || value === 'yes'
const toInt = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

const readJsonFile = async (filePath, fallback) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

const writeJsonFile = async (filePath, value) => {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
}

const pickScientificNameColumn = (columns) => {
  const candidates = [
    'Nome Científico',
    'Nome Cientifico',
    'Nome científico',
    'Scientific Name',
    'scientific_name',
    'scientificName',
  ]
  for (const c of candidates) {
    if (columns.includes(c)) return c
  }
  const lowerMap = new Map(columns.map((c) => [String(c).toLowerCase().trim(), c]))
  for (const c of candidates) {
    const found = lowerMap.get(String(c).toLowerCase().trim())
    if (found) return found
  }
  return null
}

const parseRange = (text, label) => {
  const rx = new RegExp(`${label}\\s*([0-9]+(?:\\.[0-9]+)?)\\s*[-–to]+\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i')
  const m = text.match(rx)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

const parseTemperatureF = (text) => {
  const m = text.match(/([0-9]+(?:\.[0-9]+)?)\s*[-–to]+\s*([0-9]+(?:\.[0-9]+)?)\s*°?\s*f\b/i)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const minF = Math.min(a, b)
  const maxF = Math.max(a, b)
  const fToC = (f) => ((f - 32) * 5) / 9
  return { minC: fToC(minF), maxC: fToC(maxF) }
}

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()

const stripTags = (html) =>
  normalizeText(
    html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&deg;/gi, '°'),
  )

const fetchText = async (url, { timeoutMs, userAgent, referer, signal } = {}) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? 15000)
  const handleAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    signal.addEventListener('abort', handleAbort, { once: true })
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(referer ? { referer } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    const body = await response.text()
    return { ok: response.ok, status: response.status, url: response.url, body }
  } finally {
    clearTimeout(timeoutId)
    if (signal) signal.removeEventListener('abort', handleAbort)
  }
}

const findFirstLiveAquariaProductUrl = (html) => {
  const candidates = []
  const rx = /href="([^"]+)"/gi
  for (;;) {
    const m = rx.exec(html)
    if (!m) break
    const href = m[1]
    if (!href) continue
    if (href.includes('/product/')) candidates.push(href)
  }
  const pick = candidates[0] ?? null
  if (!pick) return null
  try {
    return new URL(pick, 'https://www.liveaquaria.com').toString()
  } catch {
    return null
  }
}

const resolveLiveAquariaUrl = async (query) => {
  const url = `https://www.liveaquaria.com/search/?q=${encodeURIComponent(query)}`
  const { ok, status, body } = await fetchText(url, { timeoutMs: 15000, referer: 'https://www.liveaquaria.com/' })
  if (!ok) return { url: null, status }
  const first = findFirstLiveAquariaProductUrl(body)
  return { url: first, status }
}

const findFirstShopifyProductUrl = (html, baseUrl) => {
  const candidates = []
  const rx = /href="([^"]+)"/gi
  for (;;) {
    const m = rx.exec(html)
    if (!m) break
    const href = m[1]
    if (!href) continue
    if (href.startsWith('/products/')) candidates.push(href)
    else if (href.includes('/products/')) candidates.push(href)
  }
  const pick = candidates[0] ?? null
  if (!pick) return null
  try {
    return new URL(pick, baseUrl).toString()
  } catch {
    return null
  }
}

const resolveFreakinCoralsUrl = async (query) => {
  const baseUrl = 'https://freakincorals.com'
  const url = `${baseUrl}/search?q=${encodeURIComponent(query)}`
  const { ok, status, body } = await fetchText(url, { timeoutMs: 15000, referer: baseUrl })
  if (!ok) return { url: null, status }
  const first = findFirstShopifyProductUrl(body, baseUrl)
  return { url: first, status }
}

const parseSpecFromHtml = (htmlText) => {
  const text = stripTags(htmlText)

  const waterCondMatch = text.match(/Water Conditions\s*:\s*([^]+?)(?:\s{2,}|Diet\s*:|Temperament\s*:|Care Level\s*:|Reef Compatible\s*:|Lighting\s*:|Waterflow\s*:|$)/i)
  const waterConditions = waterCondMatch ? normalizeText(waterCondMatch[1]) : null

  const reefMatch = text.match(/Reef Compatible\s*:\s*(Yes|No|With Caution)\b/i)
  const reefCompatible = reefMatch ? reefMatch[1] : null

  const lightingMatch = text.match(/Lighting\s*:\s*([A-Za-z][A-Za-z ]+)\b/i)
  const lighting = lightingMatch ? normalizeText(lightingMatch[1]) : null

  const flowMatch = text.match(/Waterflow\s*:\s*([A-Za-z][A-Za-z ]+)\b/i)
  const flow = flowMatch ? normalizeText(flowMatch[1]) : null

  const dkh = waterConditions ? parseRange(waterConditions, 'dKH') : null
  const ph = waterConditions ? parseRange(waterConditions, 'pH') : null
  const sg = waterConditions ? parseRange(waterConditions, 'sg') : null
  const temp = waterConditions ? parseTemperatureF(waterConditions) : null

  return {
    water_conditions: waterConditions,
    reef_compatible: reefCompatible,
    lighting,
    flow,
    temp_min_c: temp ? temp.minC : null,
    temp_max_c: temp ? temp.maxC : null,
    dkh_min: dkh ? dkh.min : null,
    dkh_max: dkh ? dkh.max : null,
    ph_min: ph ? ph.min : null,
    ph_max: ph ? ph.max : null,
    sg_min: sg ? sg.min : null,
    sg_max: sg ? sg.max : null,
  }
}

const resolveSourceUrl = async (source, query) => {
  if (source === 'liveaquaria') return resolveLiveAquariaUrl(query)
  if (source === 'freakincorals') return resolveFreakinCoralsUrl(query)
  if (source === 'auto') {
    const live = await resolveLiveAquariaUrl(query)
    if (live.url) return live
    return resolveFreakinCoralsUrl(query)
  }
  return { url: null, status: null }
}

const enrichRows = async ({
  rows,
  scientificColumn,
  urlColumn,
  source,
  fallbackColumn,
  retryNotFound,
  limit,
  sleepMs,
  cachePath,
  dryRun,
}) => {
  const cache = dryRun ? {} : await readJsonFile(cachePath, {})
  const resultRows = []
  const total = Math.min(rows.length, limit ?? rows.length)

  for (let i = 0; i < total; i += 1) {
    const row = rows[i]
    const scientificName = normalizeText(row[scientificColumn] ?? '')
    const next = { ...row }
    if (!scientificName) {
      next.enrichment_status = 'missing_scientific_name'
      resultRows.push(next)
      continue
    }

    const cached = !dryRun ? cache[scientificName] : null
    if (cached && !(retryNotFound && cached.enrichment_status === 'not_found')) {
      Object.assign(next, cached, {
        enrichment_status: cached.enrichment_status ?? 'cached',
        enrichment_source: cached.enrichment_source ?? 'liveaquaria',
      })
      resultRows.push(next)
      continue
    }

    const scrapedAt = new Date().toISOString()
    let enrichment = {
      enrichment_status: 'not_started',
      enrichment_source: source,
      enrichment_query: scientificName,
      enrichment_query_used: scientificName,
      enrichment_url: null,
      enrichment_http_status: null,
      enrichment_scraped_at: scrapedAt,
      enrichment_error: null,
    }

    try {
      const providedUrl = urlColumn ? normalizeText(row[urlColumn] ?? '') : ''
      if (dryRun) {
        enrichment.enrichment_status = 'dry_run'
        enrichment.enrichment_url = providedUrl || null
      } else {
        const fallbackQuery = fallbackColumn ? normalizeText(row[fallbackColumn] ?? '') : ''
        const resolvedPrimary = providedUrl
          ? { url: providedUrl, status: null }
          : await resolveSourceUrl(source, scientificName)
        enrichment.enrichment_http_status = resolvedPrimary.status
        enrichment.enrichment_url = resolvedPrimary.url
        enrichment.enrichment_query_used = providedUrl ? providedUrl : scientificName

        if (!enrichment.enrichment_url && fallbackQuery && fallbackQuery !== scientificName) {
          const resolvedFallback = await resolveSourceUrl(source, fallbackQuery)
          enrichment.enrichment_http_status = resolvedFallback.status ?? enrichment.enrichment_http_status
          enrichment.enrichment_url = resolvedFallback.url
          enrichment.enrichment_query_used = fallbackQuery
        }
        const finalUrl = enrichment.enrichment_url
        if (!finalUrl) {
          enrichment.enrichment_status = 'not_found'
        } else {
          const page = await fetchText(finalUrl, {
            timeoutMs: 15000,
            referer: finalUrl.includes('liveaquaria.com')
              ? 'https://www.liveaquaria.com/'
              : finalUrl.includes('freakincorals.com')
                ? 'https://freakincorals.com'
                : undefined,
          })
          enrichment.enrichment_http_status = page.status
          if (!page.ok) {
            enrichment.enrichment_status = 'fetch_failed'
          } else {
            const parsed = parseSpecFromHtml(page.body)
            enrichment = {
              ...enrichment,
              ...parsed,
              enrichment_status: 'ok',
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      enrichment.enrichment_status = error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'error'
      enrichment.enrichment_error = message
    }

    Object.assign(next, enrichment)
    if (!dryRun) cache[scientificName] = enrichment
    resultRows.push(next)
    if (sleepMs) await sleep(sleepMs)
  }

  for (let i = total; i < rows.length; i += 1) resultRows.push(rows[i])
  if (!dryRun) await writeJsonFile(cachePath, cache)
  return resultRows
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))

  const input = args.input
    ? path.resolve(args.input)
    : path.resolve(process.cwd(), '..', 'dados de animais.xlsx')
  const output = args.output ? path.resolve(args.output) : path.resolve(path.dirname(input), 'dados_enriquecidos.xlsx')

  const limit = args.limit ? toInt(args.limit, null) : null
  const sleepMs = args.sleepMs ? toInt(args.sleepMs, 750) : 750
  const dryRun = toBool(args.dryRun ?? 'false')
  const source = normalizeText(args.source ?? 'auto') || 'auto'
  const fallbackColumn = args.fallbackColumn ?? null
  const retryNotFound = toBool(args.retryNotFound ?? 'false')

  const cachePath = args.cache
    ? path.resolve(args.cache)
    : path.resolve(process.cwd(), 'tools', 'enrichment-cache-liveaquaria.json')

  const xlsxModule = await import('xlsx')
  const xlsx = xlsxModule.default ?? xlsxModule
  const workbook = xlsx.readFile(input, { cellDates: false })
  const sheetName = args.sheet ?? workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) throw new Error(`Aba não encontrada: ${sheetName}`)

  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' })
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Planilha vazia')

  const columns = Object.keys(rows[0] ?? {})
  const scientificColumn = args.scientificColumn ?? pickScientificNameColumn(columns)
  if (!scientificColumn) {
    throw new Error(`Coluna de Nome Científico não encontrada. Colunas: ${columns.join(', ')}`)
  }
  const urlColumn = args.urlColumn ?? null

  const enriched = await enrichRows({
    rows,
    scientificColumn,
    urlColumn,
    source,
    fallbackColumn,
    retryNotFound,
    limit,
    sleepMs,
    cachePath,
    dryRun,
  })

  const outWb = xlsx.utils.book_new()
  const outWs = xlsx.utils.json_to_sheet(enriched)
  xlsx.utils.book_append_sheet(outWb, outWs, sheetName)
  xlsx.writeFile(outWb, output)

  const summary = enriched.reduce(
    (acc, row) => {
      const status = normalizeText(row.enrichment_status ?? '')
      if (status) acc[status] = (acc[status] ?? 0) + 1
      return acc
    },
    {},
  )

  await fs.writeFile(
    output.replace(/\.xlsx$/i, '.summary.json'),
    JSON.stringify(
      {
        input,
        output,
        sheetName,
        scientificColumn,
        urlColumn,
        source,
        fallbackColumn,
        retryNotFound,
        totalRows: rows.length,
        processedRows: Math.min(rows.length, limit ?? rows.length),
        dryRun,
        summary,
        cachePath,
      },
      null,
      2,
    ),
    'utf8',
  )

  process.stdout.write(`OK: ${output}\n`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
