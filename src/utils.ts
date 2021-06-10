import * as core from '@actions/core'
import {exec} from '@actions/exec'
import * as github from '@actions/github'
import {components} from '@octokit/openapi-types/dist-types/generated/types'
import {Endpoints} from '@octokit/types/dist-types/generated/Endpoints'

export type Octokit = ReturnType<typeof github.getOctokit>

export const createGitClient = (repoName?: string) => async (
  ...args: string[]
) => {
  await exec('git', args, {cwd: repoName})
}

export const cloneRepo = async (
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

export const getAllPullsByLoginNRepo = async (
  octokit: Octokit,
  login: string,
  repoName: string
): Promise<Endpoints['GET /repos/{owner}/{repo}/pulls']['response']> =>
  await octokit.rest.pulls.list({
    owner: login,
    repo: repoName
  })

export const getPullRequestBySha = async (
  octokit: Octokit,
  login: string,
  repoName: string,
  contextSha: string
): Promise<components['schemas']['pull-request'] | undefined> => {
  const existingPRs =
    (await getAllPullsByLoginNRepo(octokit, login, repoName))?.data || []

  // core.error(`existingPRs: ${JSON.stringify(existingPRs)}`)
  core.info(
    `checking context sha: ${contextSha} against existingPRs: ${existingPRs.map(
      ({head: {sha}}) => sha
    )}`
  )
  const pull_number = existingPRs.find(({head: {sha}}) => sha === contextSha)
    ?.number
  if (!pull_number) {
    core.info('There no PR for this hotfix yet.')
    return
  }

  return (
    await octokit.rest.pulls.get({
      owner: login,
      repo: repoName,
      pull_number
    })
  ).data
}
