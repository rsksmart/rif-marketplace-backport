import * as core from '@actions/core'
import {getPullRequestBySha, Octokit} from './utils'

type ProcessCommitPushProps = {
  login: string
  repoName: string
  contextSha: string
  branchesInput: string[]
  octokit: Octokit
  token: string
}

export const processCommitPush = async ({
  login,
  repoName,
  contextSha,
  // branchesInput,
  octokit
}: // token
ProcessCommitPushProps): Promise<void> => {
  const pull_request = await getPullRequestBySha(
    octokit,
    login,
    repoName,
    contextSha
  )
  if (!pull_request) {
    core.info('There no PR for this hotfix yet.')
    return
  }

  const {
    commits: commitCount
    // title: prTitle,
    // base: {ref: baseBranch},
    // number: pull_number
  } = pull_request

  if (commitCount > 1) {
    core.setFailed(
      'Hotfix PR has to contain only a single commit. Please squash.'
    )
  }

  // const branches = branchesInput.filter(branch => branch !== baseBranch)

  // await cloneRepo(token, login, repoName)

  // for (const branch of branches) {
  //   await createBackport({
  //     branch,
  //     login,
  //     repoName,
  //     prNumber: pull_number,
  //     prCommit: contextSha,
  //     prTitle,
  //     octokit
  //   })
  // }
}
