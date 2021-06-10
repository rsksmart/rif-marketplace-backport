import * as core from '@actions/core'
import * as github from '@actions/github'
import {PullRequest} from '@octokit/webhooks-types'
import {processCommitPush} from './processCommitPush'
import {processPullRequest} from './processPullRequest'

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

    const action = payloadAction ?? eventName // action not present on a re-run
    core.info(`action: ${action}`)
    if (!action)
      throw Error(
        'Something is wrong. There does not seem to be any action or event name.'
      )

    if (pull_request)
      return await processPullRequest({
        action,
        login,
        repoName,
        branchesInput,
        pull_request: pull_request as PullRequest,
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
    core.error(error)
    core.setFailed(error.message)
  }
}

run()

export default run
