import { parseArgs,ParseArgsConfig } from 'node:util';
import {deployNodeAnywhere, parseArgsOptions, UsageError} from "./deployNodeAnywhere";


(async () => {
    try {
        // Hack: exit if coming from jest, cause jetzt loads package.json/main  instead of looking at package.json/exports:
        if(process.argv.some(v => v == "--runInBand")) {
            return;
        }

        const parsedConfig = parseArgs({options: parseArgsOptions}).values;
        await deployNodeAnywhere(parsedConfig, console);
    }
    catch (e) {
        if(e && e instanceof UsageError) {
            console.error("Error: ${e.message}");
            process.exit(1); // Exist non successful
        }
        else {
            throw e;
        }
    }
})();

