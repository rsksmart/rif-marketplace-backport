import * as core from '@actions/core'
import {PullRequest} from '@octokit/webhooks-types'
import {createBackport} from './createBackport'
import {Octokit, cloneRepo} from './utils'

export type ProcessPullRequestProps = {
  action: string
  login: string
  repoName: string
  branchesInput: string[]
  pull_request: PullRequest
  octokit: Octokit
  token: string
}

export const processPullRequest = async ({
  action,
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
  if (commitCount > 1) {
    core.setFailed(
      'Hotfix PR has to contain only a single commit. Please squash.'
    )
    return
  }
  const branches = branchesInput.filter(branch => branch !== baseBranch)

  await cloneRepo(token, login, repoName)

  if (action === 'closed') {
    core.error('Do the backports here.')
  }
  for (const branch of branches) {
    await createBackport({
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
