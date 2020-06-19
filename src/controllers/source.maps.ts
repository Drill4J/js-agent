import fs from 'fs-extra';
import path from 'path';
import * as upath from 'upath';
import { SOURCE_MAP_FOLDER } from '../constants';
import storage from '../storage';

export async function mainScriptNames(): Promise<any> {
  const data = await storage.getMainScriptNames();
  return data;
}

export async function saveSourceMap(req, res): Promise<any> {
  const sourceMap = req.body;
  const scriptName = path.basename(sourceMap.file);

  const fileName = `${SOURCE_MAP_FOLDER}${path.sep}${scriptName}.map`;

  await fs.ensureDir(`${SOURCE_MAP_FOLDER}`);

  await fs.writeJSON(fileName, sourceMap);

  // TODO fix: that solution will break in either case of scriptName change on-the-fly or multiple script names
  await storage.addMainScriptName(scriptName);

  res.json({ status: `Source map saved as ${upath.toUnix(fileName)}` });
}

export async function getSourceMap(req, res): Promise<any> {
  const data = await storage.getMainScriptNames();
  res.json(data);
}
