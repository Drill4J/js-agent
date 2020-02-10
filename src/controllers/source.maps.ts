import fs from 'fs-extra';
import path from 'path';
import { SOURCE_MAP_FOLDER } from '../constants';
import * as upath from 'upath';

export const mainScriptNames: string[] = [];

export const saveSourceMap = async (req, res) => {
  const sourceMap = req.body;
  const scriptName = path.basename(sourceMap.file);

  const fileName = `${SOURCE_MAP_FOLDER}${path.sep}${scriptName}.map`;

  await fs.ensureDir(`${SOURCE_MAP_FOLDER}`);

  await fs.writeJSON(fileName, sourceMap);

  mainScriptNames.push(scriptName);

  res.json({ status: `Source map saved as ${upath.toUnix(fileName)}` });
};

export const getSourceMap = (req, res) => {
  res.json(mainScriptNames);
};
