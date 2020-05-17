const { workspace } = require('vscode');
const fs = require('fs');
const xml2js = require('xml2js');
const { deactivate } = require('./extension');
const path = require('path');

const builder = new xml2js.Builder();

async function checkFile() {
  const arr = await workspace.findFiles('**/*.njsproj', '**/node_modules/**', 1);
  if (arr.length === 0) {
    return false;
  } else {
    return true;
  }
}

function writeFile(njsFile, xmlObj) {
  const finalXml = builder.buildObject(xmlObj);
  fs.writeFileSync(njsFile.fsPath, finalXml, 'utf8');
}

async function getFile(e) {
  const njsprojFiles = await workspace.findFiles('**/*.njsproj', '**/node_modules/**', 5);

  if (njsprojFiles.length === 0) {
    deactivate();
    return null;
  } else {
    const njsFile = njsprojFiles.find(njs => {
      if (isRelative(path.dirname(njs.fsPath), path.dirname(e.fsPath))) {
        return njs;
      }
    });

    return njsFile;
  }
}

async function getContent(njsFile) {
  const njsDocument = await workspace.openTextDocument(njsFile.path);
  const xmlObj = await xml2js.parseStringPromise(njsDocument.getText());
  return xmlObj;
}

function isRelative(parent, dir) {
  const relative = path.relative(parent, dir);
  return !relative.startsWith('..') || path.isAbsolute(relative);
}

module.exports = {
  checkFile,
  writeFile,
  getFile,
  getContent
};
