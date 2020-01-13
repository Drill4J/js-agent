import * as express from "express";
import { Request, Response } from "express";

export class StatusControler {
    public path = "/";
    public router = express.Router();

    constructor() {
        this.initRoutes();
    }

    public initRoutes() {
        this.router.get("/", (req: Request, res: Response) => {
            res.json({status: "Listening..."});
        });
    }
}
