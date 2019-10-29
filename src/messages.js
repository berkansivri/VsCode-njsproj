const { commands, window } = require('vscode')
const { checkFile } = require('./njsproj')
const { startWatch, deactivate } = require('./extension')

function setCommands(context) {
  context.subscriptions.push(
    commands.registerCommand('extension.njsproj.activate', async() => {
      if (await checkFile()) {
        startWatch()
        window.showInformationMessage("VS Code .njsproj Activated")
      } else {
        window.showErrorMessage("Coult not found *.njsproj file in workspace")
      }
    }),
    commands.registerCommand('extension.njsproj.deactivate', () => {
      deactivate()
      window.showWarningMessage("VS Code .njsproj Deactivated")
    })
  )
}

function activatedDialog() {
  window.showInformationMessage("VS Code .njsproj Activated", "OK", "DISABLE").then(res => {
    if (res === "DISABLE") {
      window.showWarningMessage("VS Code .njsproj Deactivated")
      deactivate()
    }
  })
}

module.exports = {
  setCommands,
  activatedDialog
}
