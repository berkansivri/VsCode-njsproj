const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const xml2js = require('xml2js')


let njsprojFilePath = null
const builder = new xml2js.Builder()

function activate(context) {
  console.log("ACTIVATED");
  let disposable = vscode.commands.registerCommand('extension.helloWorld', function () {
    vscode.window.showInformationMessage('Hello World!')
  })

  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*')
  fileWatcher.onDidCreate(async (e) => {
    try {
      const document = await vscode.workspace.openTextDocument(e.path)
      console.log(path.resolve(document.fileName));
      if (!!document) {

        const parsedFilePath = path.parse(document.fileName)
        let folderPath = parsedFilePath.dir.split(vscode.workspace.name).pop().slice(1) + "\\"
        const njsFiles = await vscode.workspace.findFiles('**/*.njsproj')

        if (njsFiles.length) {

          const njsPath = njsFiles[0].path
          const content = await vscode.workspace.openTextDocument(njsPath)
          const xmlObj = await xml2js.parseStringPromise(content.getText())
          const [content1, folder] = xmlObj.Project.ItemGroup
          // FOLDER REGISTER
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
        }
      }
    } catch (ex) {
      console.log(ex);
    }

  })

  fileWatcher.onDidChange((e) => {
    // console.log("change");
    // vscode.workspace.findFiles('*/*.njsproj').then((val, err) => {
    //   console.log(val);
    //   njsprojFilePath = val[0].path
    //   fs.readFile(njsprojFilePath, (err, data) => {
    //     if (err) {
    //       vscode.window.showWarningMessage("Can not open njsproj file")
    //     }
    //     console.log(xml2js.parseString(data));
    //   })
    // })
  })

  fileWatcher.onDidDelete((e) => {
    console.log("delete");
    console.log(e)
  })

  context.subscriptions.push(disposable)
}
exports.activate = activate

function deactivate() {}

module.exports = {
  activate,
  deactivate
}