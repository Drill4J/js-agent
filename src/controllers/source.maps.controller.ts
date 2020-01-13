import fs from "fs-extra";
import path from "path";
import { BaseController } from "./base.controller";

const SOURCE_MAP_FOLDER = process.env.SOURCE_MAP_FOLDER || "./sourceMaps";

export class SourceMapsController extends BaseController {
    public initRoutes() {
        this.router.post("/source-maps", async (req, res) => {
            const sourceMap = req.body;
            const scriptName = path.basename(sourceMap.file);

            await fs.ensureDir(`${SOURCE_MAP_FOLDER}`);

            await fs.writeJSON(`${SOURCE_MAP_FOLDER}${path.sep}${scriptName}`, sourceMap);

            res.json({status: "saved"});
        });
    }

}
