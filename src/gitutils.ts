import * as core from '@actions/core'
import {exec} from '@actions/exec'

export const createGitClient = (repoName?: string) => async (
  ...args: string[]
) => {
  await exec('git', args, {
    cwd: repoName
    // env: {
    //   ...process.env,
    //   GIT_TRACE: 'true',
    //   GIT_CURL_VERBOSE: 'true',
    //   GIT_SSH_COMMAND: 'ssh -vvv',
    //   GIT_TRACE_PACK_ACCESS: 'true',
    //   GIT_TRACE_PACKET: 'true',
    //   GIT_TRACE_PACKFILE: 'true',
    //   GIT_TRACE_PERFORMANCE: 'true',
    //   GIT_TRACE_SETUP: 'true',
    //   GIT_TRACE_SHALLOW: 'true'
    // }
  })
}

export const cloneRepo = async (
  token: string,
  login: string,
  repoName: string
): Promise<void> => {
  try {
    await exec('git', ['status'])
  } catch {
    await exec('git', [
      'clone',
      `https://x-access-token:${token}@github.com/${login}/${repoName}.git`
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
  }
}

type AutoSquashProps = {
  commitCount: number
  repoName: string
  prTitle: string
  branchName: string
  token: string
  login: string
}
export const autoSquash = async ({
  commitCount,
  repoName,
  prTitle,
  branchName,
  token,
  login
}: AutoSquashProps): Promise<void> => {
  if (commitCount > 1) {
    core.warning('Hotfix contains more than one PR. Squashing...')
    const git = createGitClient(repoName)
    await cloneRepo(token, login, repoName)
    await git('checkout', '--track', `origin/${branchName}`)

    await git('reset', '--soft', '--no-quiet', `HEAD~${commitCount - 1}`)
    await git('commit', '--amend', '-m', prTitle)
    await git('push', '--force-with-lease', 'origin', `HEAD:${branchName}`)
    core.info('squashed ☠️')
  }
}
