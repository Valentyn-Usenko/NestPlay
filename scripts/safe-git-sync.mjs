#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const execFileAsync = promisify(execFile)

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000
const intervalMinutes = Number(process.env.NESTPLAY_SYNC_INTERVAL_MINUTES || 5)
const INTERVAL_MS = Number.isFinite(intervalMinutes) && intervalMinutes > 0
  ? intervalMinutes * 60 * 1000
  : DEFAULT_INTERVAL_MS

const args = new Set(process.argv.slice(2))
const watchMode = args.has('--watch')
const onceMode = args.has('--once') || !watchMode

let repoRoot = null
let gitDir = null
let lockPath = null
let ownsLock = false
let checkRunning = false

function stamp() {
  return new Date().toLocaleString()
}

function log(message = '') {
  process.stdout.write(`${message}\n`)
}

function section(title) {
  log('')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(` NESTPLAY SAFE SYNC • ${title}`)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

async function runGit(gitArgs, options = {}) {
  const { allowFailure = false } = options

  try {
    const result = await execFileAsync('git', gitArgs, {
      cwd: repoRoot || process.cwd(),
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024
    })

    return {
      ok: true,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim()
    }
  } catch (error) {
    if (allowFailure) {
      return {
        ok: false,
        stdout: String(error.stdout || '').trim(),
        stderr: String(error.stderr || error.message || '').trim()
      }
    }

    throw error
  }
}

async function discoverRepo() {
  const rootResult = await runGit(
    ['rev-parse', '--show-toplevel'],
    { allowFailure: true }
  )

  if (!rootResult.ok || !rootResult.stdout) {
    throw new Error('This command must be run inside a Git repository.')
  }

  repoRoot = rootResult.stdout

  const gitDirResult = await runGit(['rev-parse', '--absolute-git-dir'])
  gitDir = gitDirResult.stdout
}

function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function acquireWatchLock() {
  if (!watchMode || !gitDir) {
    return true
  }

  lockPath = path.join(gitDir, 'nestplay-safe-sync.lock')

  if (fs.existsSync(lockPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
      const sameHost = existing.hostname === os.hostname()

      if (sameHost && pidIsAlive(Number(existing.pid))) {
        log(`Another NestPlay sync watcher is already running (PID ${existing.pid}).`)
        return false
      }
    } catch {
      // Stale or unreadable lock; replace it below.
    }

    try {
      fs.unlinkSync(lockPath)
    } catch {
      log('Could not clear an old sync lock. Watcher will not start.')
      return false
    }
  }

  try {
    fs.writeFileSync(
      lockPath,
      JSON.stringify({
        pid: process.pid,
        hostname: os.hostname(),
        startedAt: new Date().toISOString()
      }, null, 2),
      { flag: 'wx' }
    )
    ownsLock = true
    return true
  } catch {
    log('Could not acquire the NestPlay sync lock. Watcher will not start.')
    return false
  }
}

function releaseWatchLock() {
  if (!ownsLock || !lockPath) {
    return
  }

  try {
    fs.unlinkSync(lockPath)
  } catch {
    // Best-effort cleanup only.
  }

  ownsLock = false
}

async function gitOperationInProgress() {
  const pathsToCheck = [
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
    'rebase-merge',
    'rebase-apply'
  ]

  for (const gitPath of pathsToCheck) {
    const result = await runGit(['rev-parse', '--git-path', gitPath])
    const resolved = path.isAbsolute(result.stdout)
      ? result.stdout
      : path.resolve(repoRoot, result.stdout)

    if (fs.existsSync(resolved)) {
      return gitPath
    }
  }

  return null
}

async function getCurrentBranch() {
  const result = await runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    allowFailure: true
  })

  return result.ok ? result.stdout : null
}

async function getUpstream() {
  const result = await runGit(
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    { allowFailure: true }
  )

  return result.ok ? result.stdout : null
}

async function getDirtyLines() {
  const result = await runGit([
    'status',
    '--porcelain',
    '--untracked-files=normal'
  ])

  return result.stdout
    ? result.stdout.split(/\r?\n/).filter(Boolean)
    : []
}

async function getAheadBehind(upstream) {
  const result = await runGit([
    'rev-list',
    '--left-right',
    '--count',
    `HEAD...${upstream}`
  ])

  const [aheadRaw, behindRaw] = result.stdout.split(/\s+/)
  return {
    ahead: Number(aheadRaw || 0),
    behind: Number(behindRaw || 0)
  }
}

async function syncOnce() {
  if (checkRunning) {
    return
  }

  checkRunning = true

  try {
    section(stamp())

    const branch = await getCurrentBranch()

    if (!branch) {
      log('⚠ Detached HEAD detected.')
      log('  Sync skipped. Nothing was modified.')
      return
    }

    log(`Branch: ${branch}`)

    const remoteCheck = await runGit(['remote', 'get-url', 'origin'], {
      allowFailure: true
    })

    if (!remoteCheck.ok) {
      log('⚠ No origin remote is configured.')
      log('  Sync skipped. Nothing was modified.')
      return
    }

    log('Checking GitHub...')

    const fetch = await runGit(['fetch', '--prune', '--quiet', 'origin'], {
      allowFailure: true
    })

    if (!fetch.ok) {
      log('⚠ GitHub fetch failed.')
      if (fetch.stderr) {
        log(`  ${fetch.stderr}`)
      }
      log('  Nothing was modified.')
      return
    }

    log('✓ GitHub checked')

    const upstream = await getUpstream()

    if (!upstream) {
      log('ℹ This is a local-only branch with no upstream.')
      log('  Automatic synchronization skipped.')
      return
    }

    log(`Remote: ${upstream}`)

    const operation = await gitOperationInProgress()

    if (operation) {
      log(`⚠ Git operation in progress (${operation}).`)
      log('  Pull skipped. Nothing was modified.')
      return
    }

    const dirty = await getDirtyLines()
    const { ahead, behind } = await getAheadBehind(upstream)

    if (dirty.length > 0) {
      log(`⚠ Working tree has ${dirty.length} uncommitted change${dirty.length === 1 ? '' : 's'}.`)

      if (behind > 0) {
        log(`⚠ GitHub has ${behind} newer commit${behind === 1 ? '' : 's'}.`)
      }

      log('  Automatic pull skipped to protect local work.')
      log('  Nothing was modified.')
      return
    }

    if (ahead === 0 && behind === 0) {
      log('✓ Already synchronized')
      return
    }

    if (ahead > 0 && behind === 0) {
      log(`ℹ Local branch is ${ahead} commit${ahead === 1 ? '' : 's'} ahead of GitHub.`)
      log('  No push was performed.')
      return
    }

    if (ahead > 0 && behind > 0) {
      log(`⚠ Branches have diverged: ${ahead} local / ${behind} remote commit${behind === 1 ? '' : 's'}.`)
      log('  Automatic merge/rebase skipped. Nothing was modified.')
      return
    }

    if (ahead === 0 && behind > 0) {
      log(`↓ ${behind} pushed commit${behind === 1 ? '' : 's'} found.`)
      log('↓ Fast-forwarding local branch...')

      const merge = await runGit(['merge', '--ff-only', '--quiet', upstream], {
        allowFailure: true
      })

      if (!merge.ok) {
        log('⚠ Fast-forward failed.')
        if (merge.stderr) {
          log(`  ${merge.stderr}`)
        }
        log('  No force operation was attempted.')
        return
      }

      log(`✓ Updated successfully (${behind} commit${behind === 1 ? '' : 's'})`)
    }
  } catch (error) {
    log('⚠ Sync check failed safely.')
    log(`  ${error.message}`)
    log('  Nothing was force-pushed, reset, or stashed.')
  } finally {
    checkRunning = false
  }
}

async function main() {
  try {
    await discoverRepo()
  } catch (error) {
    section(stamp())
    log(`⚠ ${error.message}`)
    process.exitCode = 1
    return
  }

  if (watchMode) {
    if (!acquireWatchLock()) {
      return
    }

    const cleanup = () => {
      releaseWatchLock()
    }

    process.on('SIGINT', () => {
      cleanup()
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      cleanup()
      process.exit(0)
    })

    process.on('exit', cleanup)

    await syncOnce()
    log(`Next check in ${Math.round(INTERVAL_MS / 60000)} minutes.`)

    setInterval(async () => {
      await syncOnce()
      log(`Next check in ${Math.round(INTERVAL_MS / 60000)} minutes.`)
    }, INTERVAL_MS)

    return
  }

  if (onceMode) {
    await syncOnce()
  }
}

await main()
