const { workspace, window, commands } = require('vscode');
const path = require('path');
const fs = require('fs');
const njsproj = require('./njsproj');

let isWriteFinished = true;
let fileWatcher = null;
let njsprojFile = null;

async function activate(context) {
  setCommands(context);
  if (await njsproj.checkFile()) {
    activatedDialog();
    startWatch();
  } else {
    deactivate();
  }
}

function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
}

function startWatch() {
  fileWatcher = workspace.createFileSystemWatcher('**/*', false, true, false);

  fileWatcher.onDidCreate(async e => {
    await waitForProcess();

    try {
      njsprojFile = await njsproj.getFile(e);

      if (njsprojFile) {
        const xmlObj = await njsproj.getContent(njsprojFile);
        const [content1, folder] = xmlObj.Project.ItemGroup;
        const isFile = fs.lstatSync(e.fsPath).isFile();

        if (isFile) {
          let filePath = path.relative(path.dirname(njsprojFile.fsPath), e.fsPath);
          const isFileExist = content1.Content.findIndex(f => f.$.Include === filePath) > -1;

          if (!isFileExist) {
            content1.Content.push({
              $: {
                Include: filePath
              }
            });
          }
        } else {
          let folderPath = path.relative(path.dirname(njsprojFile.fsPath), e.fsPath) + '\\';
          const isFolderExist = folder.Folder.findIndex(f => f.$.Include === folderPath) > -1;
          if (!isFolderExist) {
            folder.Folder.push({
              $: {
                Include: folderPath
              }
            });

            const addNestedItems = dirPath => {
              fs.readdirSync(dirPath).forEach(item => {
                let fullPath = path.join(dirPath, item);
                let njsPath = path.relative(path.dirname(njsprojFile.fsPath), fullPath);

                if (fs.lstatSync(fullPath).isDirectory()) {
                  folder.Folder.push({
                    $: {
                      Include: njsPath + '\\'
                    }
                  });
                  addNestedItems(fullPath);
                } else {
                  content1.Content.push({
                    $: {
                      Include: njsPath
                    }
                  });
                }
              });
            };

            addNestedItems(e.fsPath);
          }
        }
        await njsproj.writeFile(njsprojFile, xmlObj);
      }
    } catch (err) {
      console.log(err);
      if (err.message) window.showWarningMessage(err.message);
      else window.showWarningMessage('VS Code .njsproj failed');
      isWriteFinished = true;
    }
    isWriteFinished = true;
  });

  fileWatcher.onDidDelete(async e => {
    await waitForProcess();

    try {
      njsprojFile = await njsproj.getFile(e);

      if (njsprojFile) {
        const xmlObj = await njsproj.getContent(njsprojFile);
        const deletedWinPath = path.win32.relative(path.dirname(njsprojFile.fsPath), e.fsPath);
        const deletedPosixPath = path.posix.relative(path.dirname(njsprojFile.fsPath), e.fsPath);
        deletePath(deletedWinPath, xmlObj);
        deletePath(deletedPosixPath, xmlObj);
        await njsproj.writeFile(njsprojFile, xmlObj);
      }
    } catch (err) {
      console.log(err);
      if (err.message) window.showWarningMessage(err.message);
      else window.showWarningMessage('VS Code .njsproj failed');
      isWriteFinished = true;
    }

    isWriteFinished = true;
  });
}

function deletePath(deletedPath, xmlObj) {
  const [content1, folder, content2] = xmlObj.Project.ItemGroup;
  let deletedFolders = folder.Folder.filter(f => isWithin(deletedPath, f.$.Include));
  if (deletedFolders.length > 0) {
    folder.Folder = folder.Folder.filter(f => !deletedFolders.includes(f));
    if (content1.Content) {
      content1.Content = content1.Content.filter(f => !isWithin(deletedPath, path.dirname(f.$.Include)));
    }
    if (content2.Content) {
      content2.Content = content2.Content.filter(f => !isWithin(deletedPath, path.dirname(f.$.Include)));
    }
  } else {
    let fileIndex = content1.Content.findIndex(f => f.$.Include === deletedPath);
    if (fileIndex > -1) {
      content1.Content.splice(fileIndex, 1);
    }
    fileIndex = content2.Content.findIndex(f => f.$.Include === deletedPath);
    if (fileIndex > -1) {
      content2.Content.splice(fileIndex, 1);
    }
  }
}

async function timer(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function waitForProcess() {
  while (!isWriteFinished) {
    await timer(250);
  }
  isWriteFinished = false;
}

function isWithin(outer, inner) {
  const rel = path.relative(outer, inner);
  return !rel.startsWith('..');
}

async function setCommands(context) {
  context.subscriptions.push(
    commands.registerCommand('extension.njsproj.activate', async () => {
      if (await njsproj.checkFile()) {
        startWatch();
        window.showInformationMessage('VS Code .njsproj Activated');
      } else {
        window.showErrorMessage('Could not found *.njsproj file in workspace');
      }
    }),
    commands.registerCommand('extension.njsproj.deactivate', () => {
      deactivate();
      window.showWarningMessage('VS Code .njsproj Deactivated');
    })
  );
}

function activatedDialog() {
  window.showInformationMessage('VS Code .njsproj Activated', 'OK', 'DISABLE').then(res => {
    if (res === 'DISABLE') {
      window.showWarningMessage('VS Code .njsproj Deactivated');
      deactivate();
    }
  });
}

exports.activate = activate;

module.exports = {
  activate,
  deactivate,
  startWatch
};
