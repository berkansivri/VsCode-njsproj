const vscode = require('vscode')
const fs = require('fs')
const path = require('path')

function activate(context) {
  let disposable = vscode.commands.registerCommand('extension.helloWorld', function () {
    vscode.window.showInformationMessage('Hello World!')
  })
  console.log("activated");
  console.log(vscode.workspace.rootPath);
  const files = vscode.workspace.findFiles('*/*.njsproj').then((val,err) => {
    console.log(val);
  })

  const fileWatcher = workspace.createFileSystemWatcher('**/*')
  fileWatcher.onDidCreate(() => {})
  fileWatcher.onDidChange(() => {})
  fileWatcher.onDidDelete(() => {})

  console.log(files);

  context.subscriptions.push(disposable)
}
exports.activate = activate

function deactivate() {}

module.exports = {
  activate,
  deactivate
}