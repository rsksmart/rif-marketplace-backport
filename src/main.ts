import * as core from '@actions/core'
import * as github from '@actions/github'
import {PullRequest} from '@octokit/webhooks-types'
import {processCommitPush} from './processCommitPush'
import {processPullRequest} from './processPullRequest'

const ALLOWED_ACTIONS = ['push', 'opened', 'closed']

async function run(): Promise<void> {
  try {
    const token = core.getInput('github_token')
    core.debug(token)
    const octokit = github.getOctokit(token)

    const branchesInput = core
      .getInput('branches')
      .split(',')
      .filter(b => b !== 'staging') // FIXME: this hack was introduced just until the staging is removed from the ui and cache backport.yml
    core.debug(String(branchesInput))

    const {
      eventName,
      sha: contextSha,
      payload: {repository, action: payloadAction, pull_request}
    } = github.context

    if (!repository)
      throw Error('Something is wrong. Repository does not seem to exist.')

    const {
      owner: {login},
      name: repoName
    } = repository

    const action = payloadAction ?? eventName // action not present on in push payload
    core.info(`action: ${action}`)
    if (!action) {
      throw Error(
        'Something is wrong. There does not seem to be any action or event name.'
      )
    } else if (!ALLOWED_ACTIONS.includes(action)) {
      throw Error(`Action "${action}" is not allowed.`)
    }

    if ((pull_request as PullRequest)?.head?.ref?.startsWith('hotfix'))
      return await processPullRequest({
        action,
        login,
        repoName,
        branchesInput,
        pull_request: pull_request as PullRequest,
        octokit,
        token
      })

    if (!payloadAction) {
      return await processCommitPush({
        login,
        repoName,
        contextSha,
        branchesInput,
        octokit,
        token
      })
    }
  } catch (error) {
    core.error(error as Error)
    core.setFailed((error as Error).message)
  }
}

run()

export default run
