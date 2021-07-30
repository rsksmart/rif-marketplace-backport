import * as core from '@actions/core'
import {PullRequest} from '@octokit/webhooks-types'
import {createBackport} from './createBackport'
import {cloneRepo, autoSquash} from './gitutils'
import {deleteHeadBranch, Octokit, recoverHeadBranch} from './octoUtils'

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
    head: {sha: prCommit, ref: headBranch},
    commits: commitCount,
    title: prTitle,
    number: prNumber,
    merged
  },
  octokit,
  token
}: ProcessPullRequestProps): Promise<void> => {
  await cloneRepo(token, login, repoName)

  core.info('Attempting to squash.')
  await autoSquash({
    commitCount,
    repoName,
    prTitle,
    branchName: prCommit,
    token,
    login
  })
  try {
    core.warning(
      `Attempting to recover branch ${headBranch} with sha ${prCommit}.`
    )
    const recoveredHeadBranch = await recoverHeadBranch(octokit, {
      owner: login,
      repo: repoName,
      ref: headBranch,
      sha: prCommit
    })

    core.info(`Recovered head: ${JSON.stringify(recoveredHeadBranch, null, 2)}`)
    if (recoveredHeadBranch.status >= 300)
      throw Error(
        `Failed to recoved branch ${headBranch} from sha ${prCommit}. Data: ${JSON.stringify(
          recoveredHeadBranch.data,
          null,
          2
        )}`
      )
  } catch (error) {
    core.error(`Ref failed with: ${error}`)
  }

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

    core.warning(`All done, deleting head branch ${headBranch}..`)
    await deleteHeadBranch(octokit, {
      owner: login,
      repo: repoName,
      ref: headBranch
    })
    return
  }
}
