import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    console.log("Hello world")

    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
