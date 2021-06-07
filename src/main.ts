/* eslint-disable @typescript-eslint/no-explicit-any */
import * as core from '@actions/core'
import {exec} from '@actions/exec'
import * as github from '@actions/github'
import {WebhookPayload} from '@actions/github/lib/interfaces'

const createGit = (repoName?: string) => async (...args: string[]) => {
  await exec('git', args, {cwd: repoName})
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('github_token')
    core.debug(token)
    const octokit = github.getOctokit(token)

    const branchesInput = core.getInput('branches')
    core.debug(branchesInput)

    const {
      // action,
      pull_request,
      repository
    }: WebhookPayload = github.context.payload

    const pullRequestCommit = String(pull_request?.merge_commit_sha)
    // const pullRequestTitle = pull_request?.title

    const owner = repository?.owner.login
    const repoName = repository?.name

    const branches = branchesInput.split(',')
    await exec('git', [
      'clone',
      `https://x-access-token:${token}@github.com/${owner}/${repoName}.git`
    ])
    await exec('git', [
      'config',
      '--global',
      'user.email',
      'github-actions[bot]@users.noreply.github.com'
    ])
    await exec('git', [
      'config',
      '--global',
      'user.name',
      'github-actions[bot]'
    ])

    for (const branch of branches) {
      const head = `backport-${pull_request?.number}-to-${branch}`

      core.info(
        `Backporting ${pullRequestCommit} from #${pull_request?.number}`
      )

      const git = createGit(repoName)

      const body = `Backport ${pullRequestCommit} from #${pull_request?.number}`

      await git('switch', branch)
      await git('fetch', '--all')
      await git('switch', '--create', head)
      try {
        await git('cherry-pick', pullRequestCommit)
      } catch (error: unknown) {
        await git('cherry-pick', '--abort')
        throw error
      }

      await git('push', '--set-upstream', 'origin', head)
      const newPR = await (octokit as any).pulls.create({
        branch,
        body,
        head,
        owner,
        repoName,
        title: 'chore(sync): hotfix merge'
      })
      core.debug(newPR)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

export default run
