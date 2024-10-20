import {restfuncsExpress, ServerSessionOptions} from "restfuncs-server";
import {SourceSession} from "./SourceSession.js"
import {TargetSession} from "./TargetSession.js";
import helmet from "helmet";
import {createServer} from "vite";
import express from "express";
import http from "node:http";
import {ClientCallbackSetPerItem} from "restfuncs-server/util/ClientCallbackSetPerItem";

/**
 * Send from the source to the target when a new deploymen is about to be made (i.e. the user runs deploy-node-anywhere to deploy his app)
 */
export type NewDeploymentMessage = {

}

/**
 * Class for the application singleton (=one and only instance). You can store all **global** fixed configuration values and **global** state inside this class.
 * <p>
 * Access the application object via:
 * </p> 
 * <code><pre>
 * import {Application} from "....Application.js"
 * application. ... // <- do somethig with the global application object
 * application.data. ... // Access the data (objects that get stored in the database file /data/db.json and therefore persist a restart)
 * </pre></code>
 * 
 * Effects:
 *  - Starts a webserver on the specified port
 */
export class Application {
    // *** Configuration: ***
    port = 3000

    // **** State: ****
    webServer?: http.Server;

    /**
     * Triggered, when targets are interested in a typing friendly key -> target hex key translation.
     * key = the typing friendly key.
     * value = the listener functions that itsself returns the target hex key (or undefined when denied)
     */
    sourcesOfferingTypingFriendlyKeyTranslations = new Map<string, () => Promise<string | undefined> >();

    /**
     * Triggered, when a translation is beeing sent/(or denied - the hexKey arg is undefined then)
     * Item = the typing friendly key.
     */
    targetsListeningOnTypingFriendlyKeyTranslation = new ClientCallbackSetPerItem<string,[hexKey?:string]>({maxListenersPerClient: 1});

    /**
     * Key = = the rendevous key
     * Value = a callback function that returns itsself the NewDeploymentMessage. When multiple clients are listening, this is called multiple times
     */
    sourcesOfferingNewDeployment = new Map<string, () => Promise<NewDeploymentMessage> >();

    /**
     * Targets that wait (for weeks or months) till a new version of the user's app wants to be deployed
     * Item = the rendevous key (derived from the target key)
     * Param deploymentSpec. Contains the version or the socket.
     */
    targetsListeningForNewDeployment = new ClientCallbackSetPerItem<string,[newDeploymentMessage: NewDeploymentMessage]>({maxListenersPerClient: 1});

    constructor() {

        // Create and start web server:
        (async () => {

            const app = restfuncsExpress() // "Express" is the most commonly used webserver in node for simple purposes. Here we use an enhanced version, which gives us websockets and cookie support which both play together. For an express-how-to, see: https://expressjs.com/de/guide/routing.html

            app.use("/sourceAPI", SourceSession.createExpressHandler() );
            app.use("/targetAPI", TargetSession.createExpressHandler() );

            // Client web:
            if (process.env.NODE_ENV === 'development') {
                // Serve web web through vite dev server:
                const viteDevServer = await createServer({
                    server: {
                        middlewareMode: true
                    },
                    root: "web",
                    base: "/",
                });
                app.use(viteDevServer.middlewares)
            } else {
                app.use(express.static('web/dist')) // Serve pre-built web (npm run build)      //TODO: app.use(helmet(),...)
            }


            this.webServer = app.listen(this.port)
            console.log(`Server started: http://localhost:${this.port}`)
        })()

    }
}

/**
 * Single instance
 */
export const application = new Application();