import fs from 'fs-extra';
import path from 'path';
import * as upath from 'upath';
import storage from '../storage';

const sourceMapFolder = process.env.SOURCE_MAP_FOLDER || './sourceMaps'; // TODO that constant is used twice (fix that)

export async function mainScriptNames(): Promise<any> {
  const data = await storage.getMainScriptNames();
  return data;
}

export async function saveSourceMap(req, res): Promise<any> {
  const sourceMap = req.body;
  const scriptName = path.basename(sourceMap.file);

  const fileName = `${sourceMapFolder}${path.sep}${scriptName}.map`;

  await fs.ensureDir(`${sourceMapFolder}`);

  await fs.writeJSON(fileName, sourceMap);

  // TODO fix: that solution will break in either case of scriptName change on-the-fly or multiple script names
  await storage.addMainScriptName(scriptName);

  res.json({ status: `Source map saved as ${upath.toUnix(fileName)}` });
}

export async function getSourceMap(req, res): Promise<any> {
  const data = await storage.getMainScriptNames();
  res.json(data);
}
