import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    const token = core.getInput('github_token')
    core.debug(token)
    const branchesInput = core.getInput('branches')
    core.debug(branchesInput)

    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

export default run
