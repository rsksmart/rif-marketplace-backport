/* eslint-disable github/no-then */
import * as core from '@actions/core'
import {exec} from '@actions/exec'
import * as github from '@actions/github'
// import {WebhookPayload} from '@actions/github/lib/interfaces'
import {Endpoints} from '@octokit/types/dist-types/generated/Endpoints'

type Octokit = ReturnType<typeof github.getOctokit>

// type PullRequest = WebhookPayload['pull_request']

const createGit = (repoName?: string) => async (...args: string[]) => {
  await exec('git', args, {cwd: repoName})
}

const cloneRepo = async (
  token: string,
  login: string,
  repoName: string
): Promise<void> => {
  await exec('git', [
    'clone',
    `https://x-access-token:${token}@github.com/${login}/${repoName}.git`
  ])
  await exec('git', [
    'config',
    '--global',
    'user.email',
    'github-actions[bot]@users.noreply.github.com'
  ])
  await exec('git', ['config', '--global', 'user.name', 'github-actions[bot]'])
}

const getAllPullsByLoginNRepo = async (
  octokit: Octokit,
  login: string,
  repoName: string
): Promise<Endpoints['GET /repos/{owner}/{repo}/pulls']['response']> =>
  await octokit.rest.pulls.list({
    owner: login,
    repo: repoName
  })

type CreateBackportProps = {
  branch: string
  login: string
  repoName: string
  prNumber: number
  prCommit: string
  prTitle: string
  octokit: Octokit
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CreteBackport = (props: CreateBackportProps) => Promise<void>
const createBackport: CreteBackport = async ({
  branch,
  login,
  repoName,
  prNumber,
  prCommit,
  prTitle,
  octokit
}): Promise<void> => {
  const git = createGit(repoName)

  const newBranchName = `backport-${prNumber}-to-${branch}`

  core.info(`Backporting ${prCommit} from #${prNumber}`)

  const body = `Backport ${prCommit} from #${prNumber}`

  await git('switch', branch)
  await git('fetch', '--all')
  await git('switch', '--create', newBranchName)
  await git(
    'cherry-pick',
    '-x',
    '--strategy=recursive',
    '--diff-algorithm=patience',
    '--rerere-autoupdate',
    prCommit
  ).catch(async error => {
    await git('cherry-pick', '--abort')
    throw error
  })

  await git('push', '--set-upstream', 'origin', newBranchName)
  const newPR = await octokit.rest.pulls.create({
    base: branch,
    head: newBranchName,
    owner: login,
    repo: repoName,
    title: `chore(backport): ${prTitle}`,
    body
  })

  core.debug(JSON.stringify(newPR))
}
type ProcessPullRequestProps = {
  login: string
  repoName: string
  branchesInput: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pull_request: any
  octokit: Octokit
  token: string
}
const processPullRequest = async ({
  login,
  repoName,
  branchesInput,
  pull_request: {
    base: {ref: baseBranch},
    head: {sha: prCommit},
    commits: commitCount,
    title: prTitle,
    number: prNumber
  },
  octokit,
  token
}: ProcessPullRequestProps): Promise<void> => {
  core.error(`🐞 ᨟ ~ file: main.ts ~ line 122 ~ baseBranch ${baseBranch}`)
  core.error(`🐞 ᨟ ~ file: main.ts ~ line 122 ~ prCommit ${prCommit}`)
  core.error(`🐞 ᨟ ~ file: main.ts ~ line 122 ~ commitCount ${commitCount}`)
  core.error(`🐞 ᨟ ~ file: main.ts ~ line 122 ~ prTitle ${prTitle}`)
  core.error(`🐞 ᨟ ~ file: main.ts ~ line 122 ~ prNumber ${prNumber}`)
  if (commitCount > 1) {
    core.setFailed(
      'Hotfix PR has to contain only a single commit. Please squash.'
    )
    return
  }
  const branches = branchesInput.filter(branch => branch !== baseBranch)

  cloneRepo(token, login, repoName)

  for (const branch of branches) {
    createBackport({
      branch,
      login,
      repoName,
      prNumber,
      prCommit,
      prTitle,
      octokit
    })
  }
}

type ProcessCommitPushProps = {
  login: string
  repoName: string
  contextSha: string
  branchesInput: string[]
  octokit: Octokit
  token: string
}
const processCommitPush = async ({
  login,
  repoName,
  contextSha,
  branchesInput,
  octokit,
  token
}: ProcessCommitPushProps): Promise<void> => {
  const existingPRs =
    (await getAllPullsByLoginNRepo(octokit, login, repoName))?.data || []

  core.error(`existingPRs: ${JSON.stringify(existingPRs)}`)
  core.info(
    `checking context sha: ${contextSha} against existingPRs: ${existingPRs.map(
      ({head: {sha}}) => sha
    )}`
  )
  const ourPR = existingPRs.find(({head: {sha}}) => sha === contextSha)
  if (!ourPR?.number) {
    core.info('There no PR for this hotfix yet.')
    return
  }
  const {
    base: {ref: baseBranch},
    number
  } = ourPR

  const {commits: commitCount, title: prTitle, number: prNumber} = (
    await octokit.rest.pulls.get({
      owner: login,
      repo: repoName,
      pull_number: number
    })
  ).data
  if (commitCount > 1) {
    core.setFailed(
      'Hotfix PR has to contain only a single commit. Please squash.'
    )
    return
  }

  const branches = branchesInput.filter(branch => branch !== baseBranch)

  cloneRepo(token, login, repoName)

  for (const branch of branches) {
    createBackport({
      branch,
      login,
      repoName,
      prNumber,
      prCommit: contextSha,
      prTitle,
      octokit
    })
  }
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('github_token')
    core.debug(token)
    const octokit = github.getOctokit(token)

    const branchesInput = core.getInput('branches').split(',')
    core.debug(String(branchesInput))

    const {
      eventName,
      sha: contextSha,
      payload: {repository, action: payloadAction, pull_request}
    } = github.context

    core.error(`pull request: ${JSON.stringify(pull_request)}`)

    if (!repository)
      throw Error('Something is wrong. Repository does not seem to exist.')

    const {
      owner: {login},
      name: repoName
    } = repository

    const action = payloadAction ?? eventName
    core.info(`action: ${action}`)
    if (!action)
      throw Error(
        'Something is wrong. There does not seem to be any action or event name.'
      )

    if (pull_request)
      return await processPullRequest({
        login,
        repoName,
        branchesInput,
        pull_request,
        octokit,
        token
      })

    return await processCommitPush({
      login,
      repoName,
      contextSha,
      branchesInput,
      octokit,
      token
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

export default run
