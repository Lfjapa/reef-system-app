import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

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

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()

const toNullIfEmpty = (value) => {
  const t = normalizeText(value)
  return t ? t : null
}

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const t = normalizeText(value)
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[,"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))

  const input = args.input
    ? path.resolve(args.input)
    : path.resolve(process.cwd(), '..', '..', 'dados_enriquecidos_v2.xlsx')
  const output = args.output
    ? path.resolve(args.output)
    : path.resolve(path.dirname(input), 'bio_requirements.csv')

  const sheetName = args.sheet ?? null

  const xlsxModule = await import('xlsx')
  const xlsx = xlsxModule.default ?? xlsxModule
  const workbook = xlsx.readFile(input, { cellDates: false })
  const finalSheetName = sheetName ?? workbook.SheetNames[0]
  const worksheet = workbook.Sheets[finalSheetName]
  if (!worksheet) throw new Error(`Aba não encontrada: ${finalSheetName}`)

  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' })
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Planilha vazia')

  const outputRows = []
  for (const row of rows) {
    const scientificName = normalizeText(row['Nome Científico'] ?? row['scientific_name'] ?? '')
    if (!scientificName) continue
    if (normalizeText(row.enrichment_status ?? '') !== 'ok') continue

    outputRows.push({
      scientific_name: scientificName,
      common_name: normalizeText(row['Nome Popular'] ?? row['common_name'] ?? '') || '',
      group_name: normalizeText(row['Grupo'] ?? row['group_name'] ?? '') || '',
      water_conditions: toNullIfEmpty(row.water_conditions),
      reef_compatible: toNullIfEmpty(row.reef_compatible),
      lighting: toNullIfEmpty(row.lighting),
      flow: toNullIfEmpty(row.flow),
      temp_min_c: toNumberOrNull(row.temp_min_c),
      temp_max_c: toNumberOrNull(row.temp_max_c),
      sg_min: toNumberOrNull(row.sg_min),
      sg_max: toNumberOrNull(row.sg_max),
      ph_min: toNumberOrNull(row.ph_min),
      ph_max: toNumberOrNull(row.ph_max),
      dkh_min: toNumberOrNull(row.dkh_min),
      dkh_max: toNumberOrNull(row.dkh_max),
      source: normalizeText(row.enrichment_source ?? row.source ?? '') || '',
      source_url: normalizeText(row.enrichment_url ?? row.source_url ?? '') || '',
      scraped_at: toNullIfEmpty(row.enrichment_scraped_at ?? row.scraped_at),
    })
  }

  const header = [
    'scientific_name',
    'common_name',
    'group_name',
    'water_conditions',
    'reef_compatible',
    'lighting',
    'flow',
    'temp_min_c',
    'temp_max_c',
    'sg_min',
    'sg_max',
    'ph_min',
    'ph_max',
    'dkh_min',
    'dkh_max',
    'source',
    'source_url',
    'scraped_at',
  ]

  const lines = [header.join(',')]
  for (const row of outputRows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(','))
  }

  await fs.writeFile(output, `${lines.join('\n')}\n`, 'utf8')
  await fs.writeFile(
    output.replace(/\.csv$/i, '.summary.json'),
    JSON.stringify(
      {
        input,
        output,
        sheetName: finalSheetName,
        totalRows: rows.length,
        exportedRows: outputRows.length,
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

