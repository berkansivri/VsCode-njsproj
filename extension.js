const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const xml2js = require('xml2js')


let njsprojFilePath = null
const builder = new xml2js.Builder()

function activate(context) {
  console.log("ACTIVATED");

  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*')
  fileWatcher.onDidCreate(async (e) => {
    console.log("create");
    console.log(e);
    try {
      const isFile = fs.lstatSync(e.fsPath).isFile()
      if (isFile) {

        const parsedFilePath = path.parse(e.fsPath)
        const njsFiles = await vscode.workspace.findFiles('**/*.njsproj')

        if (njsFiles.length > 0) {

          const njsPath = njsFiles[0].path
          const content = await vscode.workspace.openTextDocument(njsPath)
          const xmlObj = await xml2js.parseStringPromise(content.getText())
          const [content1, folder] = xmlObj.Project.ItemGroup

          // FOLDER REGISTER
          let folderPath = parsedFilePath.dir.split(vscode.workspace.name).pop().slice(1) + "\\"
          const isFolderExist = folder.Folder.map(f => f.$.Include).includes(folderPath)
          if (!isFolderExist) {
            folder.Folder.push({
              $: {
                Include: folderPath
              }
            })
          }

          // FILE REGISTER
          content1.Content.push({
            $: {
              Include: path.join(folderPath, parsedFilePath.base)
            }
          })

          const finalXml = builder.buildObject(xmlObj)
          fs.writeFileSync(njsPath.substring(1), finalXml, 'utf8')
          vscode.window.showInformationMessage('File added to .njsproj')
        }
      }
    } catch (ex) {
      console.log(ex);
    }

  })

  fileWatcher.onDidChange((e) => {})

  fileWatcher.onDidDelete(async (e) => {
    console.log("delete");
    console.log(e);
    try {
      console.log(e);
      const parsedFilePath = path.parse(e.fsPath)
      const njsFiles = await vscode.workspace.findFiles('**/*.njsproj')

      if (njsFiles.length > 0) {

        const njsPath = njsFiles[0].path
        const content = await vscode.workspace.openTextDocument(njsPath)
        const xmlObj = await xml2js.parseStringPromise(content.getText())
        const [content1, folder, content2] = xmlObj.Project.ItemGroup


        const deletedPath = e.fsPath.split(vscode.workspace.name).pop().slice(1) + "\\"
        const folderIndex = folder.Folder.map(f => f.$.Include).indexOf(deletedPath)
        if (folderIndex > -1) {
          // FOLDER DELETED
          folder.Folder.splice(folderIndex, 1)
          console.log(content1.Content.length);
          // REMOVE FILES UNDER THAT FOLDER
          content1.Content = content1.Content.filter(f => (f.$.Include.split("\\").slice(0, -1).join("\\") + "\\") !== deletedPath)
          content2.Content = content2.Content.filter(f => (f.$.Include.split("\\").slice(0, -1).join("\\") + "\\") !== deletedPath)
          console.log(content1.Content.length);
        } else {
          // FILE DELETED
          let folderPath = parsedFilePath.dir.split(vscode.workspace.name).pop().slice(1) + "\\"
          const filePath = path.join(folderPath, parsedFilePath.base)
          let fileIndex = content1.Content.map(f => f.$.Include).indexOf(filePath)
          if (fileIndex > -1) {
            content1.Content.splice(fileIndex, 1)
          }
          fileIndex = content2.Content.map(f => f.$.Include).indexOf(filePath)
          if (fileIndex > -1) {
            content2.Content.splice(fileIndex, 1)
          }
        }

        const finalXml = builder.buildObject(xmlObj)
        fs.writeFileSync(njsPath.substring(1), finalXml, 'utf8')
        vscode.window.showInformationMessage('File deleted from .njsproj')
      }

    } catch (ex) {
      console.log(ex);
    }
  })
}
exports.activate = activate

function deactivate() {}

module.exports = {
  activate,
  deactivate
}