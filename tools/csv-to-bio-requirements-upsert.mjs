import fs from 'node:fs'
import path from 'node:path'
import xlsx from 'xlsx'

const inputPath = path.resolve(process.cwd(), '..', 'corals_bio_requirements_completo.csv')
const outputPath = path.resolve(process.cwd(), 'supabase_import_corals_bio_requirements.sql')

const workbook = xlsx.readFile(inputPath, { raw: false })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = xlsx.utils.sheet_to_json(sheet, { defval: null })

const columns = [
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

const numericColumns = new Set([
  'temp_min_c',
  'temp_max_c',
  'sg_min',
  'sg_max',
  'ph_min',
  'ph_max',
  'dkh_min',
  'dkh_max',
])

const escapeSql = (value) => String(value).replace(/'/g, "''")

const toSqlValue = (value, column) => {
  if (value === null || value === undefined || value === '') return 'null'
  if (numericColumns.has(column)) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? String(parsed) : 'null'
  }
  if (column === 'scraped_at') {
    return `timestamp with time zone '${escapeSql(value)}'`
  }
  return `'${escapeSql(value)}'`
}

const lines = []
lines.push(`insert into public.bio_requirements (${columns.join(', ')})`)
lines.push('values')
rows.forEach((row, index) => {
  const tuple = `  (${columns.map((column) => toSqlValue(row[column], column)).join(', ')})`
  lines.push(index === rows.length - 1 ? tuple : `${tuple},`)
})
lines.push('on conflict (scientific_name) do update set')
lines.push('  common_name = excluded.common_name,')
lines.push('  group_name = excluded.group_name,')
lines.push('  water_conditions = excluded.water_conditions,')
lines.push('  reef_compatible = excluded.reef_compatible,')
lines.push('  lighting = excluded.lighting,')
lines.push('  flow = excluded.flow,')
lines.push('  temp_min_c = excluded.temp_min_c,')
lines.push('  temp_max_c = excluded.temp_max_c,')
lines.push('  sg_min = excluded.sg_min,')
lines.push('  sg_max = excluded.sg_max,')
lines.push('  ph_min = excluded.ph_min,')
lines.push('  ph_max = excluded.ph_max,')
lines.push('  dkh_min = excluded.dkh_min,')
lines.push('  dkh_max = excluded.dkh_max,')
lines.push('  source = excluded.source,')
lines.push('  source_url = excluded.source_url,')
lines.push('  scraped_at = excluded.scraped_at,')
lines.push('  updated_at = now();')

fs.writeFileSync(outputPath, lines.join('\n'), 'utf8')
console.log(`rows: ${rows.length}`)
console.log(`output: ${outputPath}`)
