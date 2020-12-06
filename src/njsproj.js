const { workspace } = require('vscode');
const fs = require('fs');
const xml2js = require('xml2js');
const { deactivate } = require('./extension');
const path = require('path');

const builder = new xml2js.Builder();

async function checkFile() {
  const arr = await workspace.findFiles('**/*.njsproj', '**/node_modules/**', 1);
  return arr.length !== 0;
}

async function writeFile(njsFile, xmlObj) {
  const finalXml = builder.buildObject(xmlObj);
  await fs.promises.writeFile(njsFile.fsPath, finalXml, 'utf8');
}

async function getFile(e) {
  const njsprojFiles = await workspace.findFiles('**/*.njsproj', '**/node_modules/**', 5);

  if (njsprojFiles.length === 0) {
    deactivate();
    return null;
  } else {
    return njsprojFiles.find(njs => isRelative(path.dirname(njs.fsPath), path.dirname(e.fsPath)));
  }
}

async function getContent(njsFile) {
  const njsDocument = await workspace.openTextDocument(njsFile.path);
  return await xml2js.parseStringPromise(njsDocument.getText());
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
