import fs from 'fs-extra';
import path from 'path';
import { SOURCE_MAP_FOLDER } from '../constants';
import { BaseController } from './base.controller';

export const mainScriptNames: string[] = [];

export class SourceMapsController extends BaseController {
  public initRoutes() {
    this.router.post('/source-maps', async (req, res) => {
      const sourceMap = req.body;
      const scriptName = path.basename(sourceMap.file);

      const fileName = `${SOURCE_MAP_FOLDER}${path.sep}${scriptName}.map`;

      await fs.ensureDir(`${SOURCE_MAP_FOLDER}`);

      await fs.writeJSON(fileName, sourceMap);

      mainScriptNames.push(scriptName);

      res.json({ status: `Source map saved as ${fileName}` });
    });
  }
}
