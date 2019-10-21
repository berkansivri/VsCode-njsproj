const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const xml2js = require('xml2js')


const builder = new xml2js.Builder()
let isWriteFinished = true

function activate(context) {
  console.log("ACTIVATED");

  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, true, false)
  fileWatcher.onDidCreate(async (e) => {
    console.log("create")
    try {

      await waitForProcess()
      isWriteFinished = false

      const njsFile = await getNjsprojFile();
      const xmlObj = await getNjsprojContent(njsFile)
      const [content1, folder] = xmlObj.Project.ItemGroup

      const isFile = fs.lstatSync(e.fsPath).isFile()
      if (isFile) {
        let filePath = path.normalize(vscode.workspace.asRelativePath(e.fsPath))
        const isFileExist = content1.Content.map(f => f.$.Include).includes(filePath)
        if (!isFileExist) {
          content1.Content.push({
            $: {
              Include: filePath
            }
          })
        }
      } else {
        let folderPath = path.normalize(vscode.workspace.asRelativePath(e.fsPath)) + "\\"
        const isFolderExist = folder.Folder.map(f => f.$.Include).includes(folderPath)
        if (!isFolderExist) {
          folder.Folder.push({
            $: {
              Include: folderPath
            }
          })
        }
      }

      const finalXml = builder.buildObject(xmlObj)
      fs.writeFileSync(njsFile.fsPath, finalXml, 'utf8')
      vscode.window.showInformationMessage('.njsproj updated')
    } catch (ex) {
      console.log(ex);
      if (ex.message) vscode.window.showWarningMessage(err.message)
      isWriteFinished = true
    }
    isWriteFinished = true
  })

  fileWatcher.onDidDelete(async (e) => {
    console.log("delete")
    try {
      await waitForProcess()
      isWriteFinished = false

      const njsFile = await getNjsprojFile();
      const xmlObj = await getNjsprojContent(njsFile)
      const [content1, folder, content2] = xmlObj.Project.ItemGroup

      let deletedPath = path.normalize(vscode.workspace.asRelativePath(e.fsPath))

      const deletedFolders = folder.Folder.filter(f => f.$.Include.slice(0, -1).includes(deletedPath))

      if (deletedFolders.length > 0) {
        // Remove nested folders
        folder.Folder = folder.Folder.filter(f => !deletedFolders.includes(f))
        // Remove Files Under Deleted Folder
        content1.Content = content1.Content.filter(f => !path.dirname(f.$.Include).includes(deletedPath))
        content2.Content = content2.Content.filter(f => !path.dirname(f.$.Include).includes(deletedPath))
      } else {
        let fileIndex = content1.Content.map(f => f.$.Include).indexOf(deletedPath)
        if (fileIndex > -1) {
          content1.Content.splice(fileIndex, 1)
        } else {
          fileIndex = content2.Content.map(f => f.$.Include).indexOf(deletedPath)
          if (fileIndex > -1) {
            content2.Content.splice(fileIndex, 1)
          }
        }
      }

      const finalXml = builder.buildObject(xmlObj)
      fs.writeFileSync(njsFile.fsPath, finalXml, 'utf8')
      vscode.window.showInformationMessage('.njsproj updated')
    } catch (ex) {
      console.log(ex);
      if (ex.message) vscode.window.showWarningMessage(ex.message)
      isWriteFinished = true
    }
    isWriteFinished = true
  })
}
exports.activate = activate

function deactivate() {}

async function getNjsprojFile() {
  const njsprojFile = await vscode.workspace.findFiles('**/*.njsproj')
  if (njsprojFile.length === 0) {
    deactivate()
    return []
  } else return njsprojFile[0]
}

async function getNjsprojContent(njsProjFile) {
  const content = await vscode.workspace.openTextDocument(njsProjFile.path)
  const xmlObj = await xml2js.parseStringPromise(content.getText())
  return xmlObj
}

async function waitForProcess() {
  const timer = (ms) => {
    return new Promise(res => setTimeout(res, ms))
  }
  while (!isWriteFinished) {
    await timer(50)
  }
  return
}

module.exports = {
  activate,
  deactivate
}