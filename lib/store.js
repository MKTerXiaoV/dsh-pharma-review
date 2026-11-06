// 本机数据：$DSH_HOME/pharma-review/（没有 DSH_HOME 时是 ~/.dsh）
//   archive.json            体检档案：每次体检一条，同一份方案（同标题）的多次体检按时间排成改前改后
//   calibration/<skill>.md  校准规则：用户亲手改过、纠正过的判断，替代独立仓库里的 EXTEND.md
// 插件里的 skill 目录随插件更新整个覆盖，用户自己的东西不能放在那里。
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const dataDir = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'pharma-review')
const archiveFile = () => join(dataDir(), 'archive.json')
const calibrationFile = (skill) => join(dataDir(), 'calibration', `${skill}.md`)

function writeAtomic(file, text) {
  mkdirSync(join(file, '..'), { recursive: true })
  const tmp = `${file}.${process.pid}`
  writeFileSync(tmp, text)
  renameSync(tmp, file)
}

export function readArchive() {
  try {
    const data = JSON.parse(readFileSync(archiveFile(), 'utf8'))
    return Array.isArray(data.records) ? data.records : []
  } catch {
    return []
  }
}

export function addRecord(input) {
  const records = readArchive()
  const record = { id: randomUUID().slice(0, 8), createdAt: new Date().toISOString(), ...input }
  writeAtomic(archiveFile(), JSON.stringify({ records: [record, ...records] }, null, 2) + '\n')
  return record
}

export function removeRecord(id) {
  const records = readArchive()
  const next = records.filter((r) => r.id !== id)
  if (next.length === records.length) return false
  writeAtomic(archiveFile(), JSON.stringify({ records: next }, null, 2) + '\n')
  return true
}

// 同一份方案的历次体检，新的在前
export const versionsOf = (title) => readArchive().filter((r) => r.title === title)

export function readCalibration(skill) {
  try { return readFileSync(calibrationFile(skill), 'utf8') } catch { return null }
}

export function addCalibration(skill, rule) {
  const file = calibrationFile(skill)
  if (!existsSync(file)) writeAtomic(file, `# ${skill} 校准规则\n\n用户亲手改过、纠正过的判断。体检时优先于 skill 的通用规则。\n\n`)
  const day = new Date().toISOString().slice(0, 10)
  appendFileSync(file, `- ${day}：${rule.replace(/\s*\n\s*/g, ' ').trim()}\n`)
  return file
}
