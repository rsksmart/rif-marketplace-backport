import * as core from '@actions/core'
import * as github from '@actions/github'
import {components} from '@octokit/openapi-types/dist-types/generated/types'
import {Endpoints} from '@octokit/types/dist-types/generated/Endpoints'
import {OctokitResponse} from '@octokit/types/dist-types/OctokitResponse'

export type Octokit = ReturnType<typeof github.getOctokit>

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

  core.info(
    `checking context sha: ${contextSha} against existingPRs: ${existingPRs.map(
      ({head: {sha}}) => sha
    )}`
  )
  const pull_number = existingPRs.find(({head: {sha}}) => sha === contextSha)
    ?.number
  if (!pull_number) {
    core.info('No PR found for this hotfix yet.')
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

export type Ref = {
  ref: string
  node_id: string
  url: string
  object: {
    sha: string
    type: string
    url: string
  }
}

export const recoverHeadBranch = async (
  octokit: Octokit,
  {ref, ...rest}: {owner: string; repo: string; ref: string; sha: string}
): Promise<OctokitResponse<Ref>> =>
  octokit.request('POST /repos/{owner}/{repo}/git/refs', {
    ref: `refs/heads/${ref}`,
    ...rest
  })

export const deleteHeadBranch = async (
  octokit: Octokit,
  {ref, ...rest}: {owner: string; repo: string; ref: string}
): Promise<OctokitResponse<{}>> =>
  octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
    ref: `heads/${ref}`,
    ...rest
  })
