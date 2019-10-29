const { workspace, window } = require('vscode')
const path = require('path')
const fs = require('fs')
const { setCommands, activatedDialog } = require('./messages')
const njsproj = require('./njsproj')

let isWriteFinished = true
let fileWatcher = null
let njsprojFile = null
async function activate(context) {
  console.log("ACTIVATED")
  setCommands(context)
  
  if (await njsproj.checkFile()) {
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
      njsprojFile = await njsproj.getFile(e)

      if (njsprojFile) {
        const xmlObj = await njsproj.getContent(njsprojFile)
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
        njsproj.writeFile(njsprojFile, xmlObj)
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
      njsprojFile = await njsproj.getFile(e)

      if (njsprojFile) {
        const xmlObj = await njsproj.getContent(njsprojFile)
        const [content1, folder, content2] = xmlObj.Project.ItemGroup

        const deletedPath = path.relative(path.dirname(njsprojFile.fsPath), e.fsPath)
        
        let deletedFolders = folder.Folder.filter(f => isWithin(path.dirname(deletedPath), path.dirname(f.$.Include)))

        if (deletedFolders.length > 0) {
          folder.Folder = folder.Folder.filter(f => !deletedFolders.includes(f))
          content1.Content = content1.Content.filter(f => isWithin(path.dirname(deletedPath), path.dirname(f.$.Include)))
          content2.Content = content2.Content.filter(f => isWithin(path.dirname(deletedPath), path.dirname(f.$.Include)))
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

        njsproj.writeFile(njsprojFile, xmlObj)
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

async function timer(ms) {
  return new Promise(res => setTimeout(res, ms))
}

async function waitForProcess() {
  while (!isWriteFinished) {
    await timer(50)
  }
  isWriteFinished = false
}

function isWithin(outer, inner) {
  const rel = path.relative(outer, inner);
  return !rel.startsWith("..")
}

exports.activate = activate

module.exports = {
  activate,
  deactivate,
  startWatch
}
