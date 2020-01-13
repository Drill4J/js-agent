import { App } from "./app";

import * as bodyParser from "body-parser";
import { SourceMapsController } from "./controllers/source.maps.controller";
import { StatusControler } from "./controllers/status.controller";
import { loggerMiddleware } from "./middleware/logger";

const PORT = parseInt(process.env.PORT) || 8080;

export const app = new App({
    port: PORT,
    controllers: [
        new StatusControler(),
        new SourceMapsController()
    ],
    middleWares: [
        bodyParser.json(),
        bodyParser.urlencoded({ extended: true }),
        // loggerMiddleware
    ]
});

export const server = app.listen();
