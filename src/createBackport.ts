import * as core from '@actions/core'
import {createGitClient} from './gitutils'
import {Octokit} from './octoUtils'

export type CreateBackportProps = {
  branch: string
  login: string
  repoName: string
  prNumber: number
  prCommit: string
  prTitle: string
  octokit: Octokit
}

export const createBackport = async ({
  branch,
  login,
  repoName,
  prNumber,
  prCommit,
  prTitle,
  octokit
}: CreateBackportProps): Promise<void> => {
  const git = createGitClient(repoName)

  const backportBranch = `backport-${prNumber}-to-${branch}`

  core.info(`Backporting ${prCommit} from #${prNumber}`)

  const body = `Backport ${prCommit} from #${prNumber}`

  await git('switch', branch)
  await git('fetch', '--all')
  await git('switch', '--create', backportBranch)
  try {
    await git(
      'cherry-pick',
      '-x',
      '--diff-algorithm=patience',
      '--strategy-option=patience',
      '--rerere-autoupdate',
      prCommit
    )
  } catch (error) {
    core.error(`Cherry pick failed with: ${error.message}`)
    await git('add', '.')
    await git(
      'commit',
      `--message=RESOLVE CONFLICTS AND SQUASH ME!

      When done with conflicts, run:
      git rebase -i HEAD~ to reword message to:
      ${prTitle}`
    )
  }

  try {
    await git('push', '--set-upstream', 'origin', backportBranch)
    core.info('Branch pushed')
    core.info('Creating pull request:.')
    core.info(`{
      base: ${branch},
      head: ${backportBranch},
      owner: ${login},
      repo: ${repoName},
      title: ${`chore(backport): ${prTitle}`},
      body: ${body}
    }`)
    const newPR = await octokit.rest.pulls.create({
      base: branch,
      head: backportBranch,
      owner: login,
      repo: repoName,
      title: `chore(backport): ${prTitle}`,
      body
    })
    core.info('PR created.')
    core.debug(JSON.stringify(newPR))
  } catch (error) {
    core.error(`BOOOOO: ${error}`)
  }
}
