const { workspace, window, commands } = require('vscode')
const path = require('path')
const fs = require('fs')
const xml2js = require('xml2js')


const builder = new xml2js.Builder()
let isWriteFinished = true
let fileWatcher = null
let njsprojFile = null

async function activate(context) {
  console.log("ACTIVATED")
  setCommands(context)
  
  if (await checkNjsprojFile()) {
    activatedDialog()
    startWatch()
  } else {
    deactivate()
  }
}

function deactivate() {
  console.log("DEACTIVATED")
  if (fileWatcher) {
    fileWatcher.dispose()
  }
}

function startWatch() {
  fileWatcher = workspace.createFileSystemWatcher('**/*', false, true, false)
  console.log("start watch");
  fileWatcher.onDidCreate(async (e) => {
    await waitForProcess()

    try {
      njsprojFile = await getNjsprojFile(e)
      if (njsprojFile) {
        const xmlObj = await getNjsprojContent()
        const [content1, folder] = xmlObj.Project.ItemGroup
        const isFile = fs.lstatSync(e.fsPath).isFile()
        if (isFile) {
          let filePath = path.relative(path.dirname(njsprojFile.fsPath), e.fsPath)
          const isFileExist = content1.Content.findIndex(f => f.$.Include === filePath) > -1
          if (!isFileExist) {
            content1.Content.push({
              $: {
                Include: filePath
              }
            })
          }
        } else {
          let folderPath = path.relative(path.dirname(njsprojFile.fsPath), e.fsPath) + path.sep
          const isFolderExist = folder.Folder.findIndex(f => f.$.Include === folderPath) > -1
          if (!isFolderExist) {
            folder.Folder.push({
              $: {
                Include: folderPath
              }
            })
            const addNestedItems = (dirPath) => {
              fs.readdirSync(dirPath).forEach(item => {
                let fullPath = path.join(dirPath, item)
                let njsPath = path.relative(path.dirname(njsprojFile.fsPath), fullPath)
                if (fs.lstatSync(fullPath).isDirectory()) {
                  folder.Folder.push({
                    $: {
                      Include: njsPath + path.sep
                    }
                  })
                  addNestedItems(fullPath)
                } else {
                  content1.Content.push({
                    $: {
                      Include: njsPath
                    }
                  })
                }
              })
            }
            addNestedItems(e.fsPath)
          }
        }
        writeNjsprojFile(xmlObj)
      }
    } catch (ex) {
      console.log(ex)
      if (ex.message) window.showWarningMessage(err.message)
      else window.showWarningMessage("VS Code .njsproj failed")
      isWriteFinished = true
    }
    isWriteFinished = true
  })

  fileWatcher.onDidDelete(async (e) => {
    await waitForProcess()
    try {
      njsprojFile = await getNjsprojFile(e)
      if (njsprojFile) {
        const xmlObj = await getNjsprojContent()
        const [content1, folder, content2] = xmlObj.Project.ItemGroup

        let deletedPath = path.relative(path.dirname(njsprojFile.fsPath), e.fsPath)

        const deletedFolders = folder.Folder.filter(f => f.$.Include.slice(0, -1).includes(deletedPath))

        if (deletedFolders.length > 0) {
          folder.Folder = folder.Folder.filter(f => !deletedFolders.includes(f))
          content1.Content = content1.Content.filter(f => !path.dirname(f.$.Include).includes(deletedPath))
          content2.Content = content2.Content.filter(f => !path.dirname(f.$.Include).includes(deletedPath))
        } else {
          let fileIndex = content1.Content.findIndex(f => f.$.Include === deletedPath)
          if (fileIndex > -1) {
            content1.Content.splice(fileIndex, 1)
          } else {
            fileIndex = content2.Content.findIndex(f => f.$.Include === deletedPath)
            if (fileIndex > -1) {
              content2.Content.splice(fileIndex, 1)
            }
          }
        }

        writeNjsprojFile(xmlObj)
      }
    } catch (ex) {
      console.log(ex)
      if (ex.message) window.showWarningMessage(ex.message)
      else window.showWarningMessage("VS Code .njsproj failed")
      isWriteFinished = true
    }
    isWriteFinished = true
  })
}

function setCommands(context) {
  context.subscriptions.push(
    commands.registerCommand('extension.njsproj.activate', async() => {
      if (await checkNjsprojFile()) {
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

async function checkNjsprojFile() {
  const arr = await workspace.findFiles('**/*.njsproj', '**/node_modules/**', 1)
  if (arr.length === 0) {
    return false
  } else {
    return true
  }
}

function activatedDialog() {
  window.showInformationMessage("VS Code .njsproj Activated", "OK", "DISABLE").then(res => {
    if (res === "DISABLE") {
      window.showWarningMessage("VS Code .njsproj Deactivated")
      deactivate()
    }
  })
}

function writeNjsprojFile(xmlObj) {
  const finalXml = builder.buildObject(xmlObj)
  fs.writeFileSync(njsprojFile.fsPath, finalXml, 'utf8')
}

async function getNjsprojFile(e) {
  const njsprojFiles = await workspace.findFiles('**/*.njsproj', '**/node_modules/**', 5)
  if (njsprojFiles.length === 0) {
    deactivate()
    return null
  } else {
    const njsFile = njsprojFiles.find(njs => {
      if (isRelative(path.dirname(njs.fsPath), path.dirname(e.fsPath))) {
        return njs
      }
    })
    return njsFile
  }
}

async function getNjsprojContent() {
  const njsDocument = await workspace.openTextDocument(njsprojFile.path)
  const xmlObj = await xml2js.parseStringPromise(njsDocument.getText())
  return xmlObj
}

async function timer(ms) {
  return new Promise(res => setTimeout(res, ms))
}

async function waitForProcess() {
  while (!isWriteFinished) {
    await timer(50)
  }
  isWriteFinished = false
}

function isRelative(parent, dir) {
  const relative = path.relative(parent, dir)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

exports.activate = activate

module.exports = {
  activate,
  deactivate
}