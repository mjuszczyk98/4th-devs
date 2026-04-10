import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const usage = () => {
  console.error(
    'Usage: node ./scripts/run-workspace-script.mjs <script> <workspace...> [--workspace <name>] [-- <args>]',
  )
}

const argv = process.argv.slice(2)

if (argv.length < 2) {
  usage()
  process.exit(1)
}

const scriptName = argv[0]
const workspaceArgs = []
const forwardedArgs = []
let workspaceFilter = null
let parsingForwardedArgs = false

for (let index = 1; index < argv.length; index += 1) {
  const value = argv[index]

  if (parsingForwardedArgs) {
    forwardedArgs.push(value)
    continue
  }

  if (value === '--') {
    parsingForwardedArgs = true
    continue
  }

  if (value === '--workspace') {
    workspaceFilter = argv[index + 1] ?? null
    index += 1
    continue
  }

  if (value.startsWith('--workspace=')) {
    workspaceFilter = value.slice('--workspace='.length)
    continue
  }

  if (value.startsWith('-')) {
    forwardedArgs.push(...argv.slice(index))
    break
  }

  workspaceArgs.push(value)
}

if (workspaceArgs.length === 0) {
  usage()
  process.exit(1)
}

const loadWorkspace = (workspacePath) => {
  const directory = resolve(process.cwd(), workspacePath)
  const packageJsonPath = resolve(directory, 'package.json')

  if (!existsSync(packageJsonPath)) {
    throw new Error(`workspace package.json not found: ${workspacePath}`)
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

  return {
    directory,
    name: typeof packageJson.name === 'string' ? packageJson.name : basename(directory),
    packageJson,
    workspacePath,
  }
}

const workspaces = workspaceArgs.map(loadWorkspace)
const selectedWorkspaces = workspaceFilter
  ? workspaces.filter(
      (workspace) =>
        workspace.name === workspaceFilter || workspace.workspacePath === workspaceFilter,
    )
  : workspaces

if (selectedWorkspaces.length === 0) {
  console.error(
    `No workspace matched "${workspaceFilter}". Available: ${workspaces.map((workspace) => workspace.name).join(', ')}`,
  )
  process.exit(1)
}

const userAgent = process.env.npm_config_user_agent ?? ''
const isBun = userAgent.startsWith('bun/')
const command = process.platform === 'win32' ? (isBun ? 'bun.exe' : 'npm.cmd') : isBun ? 'bun' : 'npm'
const commandArgsPrefix = ['run', scriptName]

for (const workspace of selectedWorkspaces) {
  if (typeof workspace.packageJson?.scripts?.[scriptName] !== 'string') {
    console.error(`Script "${scriptName}" not found in workspace ${workspace.name}`)
    process.exit(1)
  }

  const result = spawnSync(command, [...commandArgsPrefix, ...forwardedArgs], {
    cwd: workspace.directory,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }

  if (result.signal) {
    process.kill(process.pid, result.signal)
  }
}
