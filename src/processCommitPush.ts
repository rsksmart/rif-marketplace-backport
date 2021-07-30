import * as core from '@actions/core'
import {autoSquash} from './gitutils'
import {getPullRequestBySha, Octokit} from './octoUtils'

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
  octokit,
  token
}: ProcessCommitPushProps): Promise<void> => {
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
    commits: commitCount,
    title: prTitle,
    head: {ref: branchName}
  } = pull_request

  await autoSquash({commitCount, repoName, prTitle, branchName, token, login})
}
