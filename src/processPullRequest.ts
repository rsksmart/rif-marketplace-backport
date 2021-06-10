import {PullRequest} from '@octokit/webhooks-types'
import {createBackport} from './createBackport'
import {autoSquash, cloneRepo, Octokit} from './utils'

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
    number: prNumber,
    merged
  },
  octokit,
  token
}: ProcessPullRequestProps): Promise<void> => {
  await cloneRepo(token, login, repoName)

  await autoSquash({
    commitCount,
    repoName,
    prTitle,
    branchName: prCommit,
    token,
    login
  })
  const branches = branchesInput.filter(branch => branch !== baseBranch)

  if (action === 'closed' && merged) {
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
    return
  }
}
