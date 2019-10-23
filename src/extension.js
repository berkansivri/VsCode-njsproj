const { workspace, window } = require('vscode')
const path = require('path')
const fs = require('fs')
const xml2js = require('xml2js')


const builder = new xml2js.Builder()
let isWriteFinished = true
let fileWatcher = null
let njsprojFile = null

function activate(context) {
  console.log("ACTIVATED")
  
  workspace.findFiles('**/*.njsproj', '**/node_modules/**', 1).then(arr => arr.length === 0 && deactivate())
  
  fileWatcher = workspace.createFileSystemWatcher('**/*', false, true, false)
  fileWatcher.onDidCreate(async (e) => {
    console.log("created");
    await waitForProcess()

    try {
      njsprojFile = await getNjsprojFile(e)
      if (njsprojFile) {
        const xmlObj = await getNjsprojContent()
        const [content1, folder, content2] = xmlObj.Project.ItemGroup
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
            // folder.Folder.push(...subFolders.map(f => f.$.Include = ))
          }
          //    TODO
          // const filesUnderFolder = [
          //   ...content1.Content.filter(f => f.$.Include.includes(folderPath)), 
          //   ...content2.Content.filter(f => f.$.Include.includes(folderPath))
          // ]
          // if(filesUnderFolder.length > 0) {
          //   content1.Content.push(...filesUnderFolder)
          // }
        }

        writeNjsprojFile(xmlObj)
      }
    } catch (ex) {
      console.log(ex)
      if (ex.message) window.showWarningMessage(err.message)
      else window.showWarningMessage("VsCode .njsproj failed")
      isWriteFinished = true
    }
    isWriteFinished = true
  })

  fileWatcher.onDidDelete(async (e) => {
    console.log("deleted");
    await waitForProcess()
    try {
      njsprojFile = await getNjsprojFile(e)
      if (njsprojFile) {
        const xmlObj = await getNjsprojContent()
        const [content1, folder, content2] = xmlObj.Project.ItemGroup

        let deletedPath = path.relative(path.dirname(njsprojFile.fsPath), e.fsPath)

        const deletedFolders = folder.Folder.filter(f => f.$.Include.slice(0, -1).includes(deletedPath))

        if (deletedFolders.length > 0) {
          // Remove nested folders
          folder.Folder = folder.Folder.filter(f => !deletedFolders.includes(f))
          // Remove Files Under Deleted Folder
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
      else window.showWarningMessage("VsCode .njsproj failed")
      isWriteFinished = true
    }
    isWriteFinished = true
  })
}

function deactivate() {
  console.log("DEACTIVATE");
  fileWatcher.dispose()
}

function writeNjsprojFile(xmlObj) {
  const finalXml = builder.buildObject(xmlObj)
  fs.writeFileSync(njsprojFile.fsPath, finalXml, 'utf8')
}

async function getNjsprojFile(e) {
  const njsprojFiles = await workspace.findFiles('**/*.njsproj', '**/node_modules/**', 5)
  if (njsprojFiles.length === 0) {
    deactivate()
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