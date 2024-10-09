import {ParseArgsConfig} from "node:util";
import {CommandEntry, parse as parseDockerFile} from "docker-file-parser";
import pem from "pem-file";
import * as fs from "fs";
import path from "node:path";
import nacl from "tweetnacl";
import nacl_util from "tweetnacl-util"

export class DNAConfig {
    /**
     * See command-line-arguments.md
     */
    sourceDir?: string;

    /**
     * See command-line-arguments.md
     */
    dockerfile?: string;

    /**
     * See command-line-arguments.md
     */
    allowRunCommands?: boolean;
}

/**
 * From .deploy-node-anywhere/state.json
 */
type State = {
    diagnosis_existingDockerfileSeenOnFirstRun?:boolean
}

export const parseArgsOptions: ParseArgsConfig["options"] = {
    prefix: { type: 'string'},
    dockerfile: {type: "string"},
    repository: {type: "string"},
    volume: {type: "string", multiple: true},
    allowRunCommands: {type: "boolean"}
};

export async function deployNodeAnywhere(config: Config, console?: Console) {
    const sourceDir = path.resolve(config.sourceDir || ".");

    // Read state:
    let state: State = {};
    let isFistRun = true;
    const stateDir = `${sourceDir}/.deploy-node-anywhere`;
    if(fs.existsSync(`${stateDir}/state.json`)) {
        state = JSON.parse(fs.readFileSync(`${stateDir}/state.json`, {encoding: "utf8"}));
        isFistRun = false;
    }
    function saveState() {
        if(!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir);
        }
        fs.writeFileSync(`${stateDir}/state.json`, JSON.stringify(state), {})
    }

    // Create .dockerignore file (if not yet exists):
    let dockerignoreFilePath = `${sourceDir}/.dockerignore`;
    if(!fs.existsSync(dockerignoreFilePath)) { // no .dockerignore file yet ?
        let content = "";
        content+=".git\n"
        content+=".idea\n"
        content+=".code\n"
        content+=".deploy-node-anywhere\n"
        content+=".*\n"
        content+="node_modules\n"


        fs.writeFileSync(dockerignoreFilePath, content, {encoding: "utf8"});
    }

    // Create docker file (if not yet exists):
    let dockerFilePath = `${sourceDir}/${config.dockerfile || "Dockerfile"}`;
    if(!fs.existsSync(dockerFilePath)) { // no docker file yet ?

        // *** Create a Dockerfile: ****

        // read package.json:
        const packageJsonPath = `${sourceDir}/package.json`;
        if(!fs.existsSync(packageJsonPath)) {
            throw new UsageError(`No package.json found and no Dockerfile found in ${sourceDir}`);
        }
        let packageJson: any
        try {
            packageJson = JSON.parse(fs.readFileSync(packageJsonPath, {encoding: "utf8"}));
        }
        catch (e) {
            //@ts-ignore
            throw new Error(`Error parsing ${packageJsonPath}: ${e.message}`, {cause: e});
        }

        console?.log("No Dockerfile found. Creating one.");

        let newDockerfileContent = "";
        // FROM
        newDockerfileContent+= "FROM node\n";

        // WORKDIR:
        newDockerfileContent+="WORKDIR /app\n";

        // NPM ci:
        newDockerfileContent+="\n# Do a clean install of all npm (production-) packages from package-lock.json\n";
        newDockerfileContent+="COPY package-lock.json /app\n";
        newDockerfileContent+=`RUN ${NPM_CI_COMMAND_LINE}\n\n`;

        newDockerfileContent+="COPY . /app\n";

        newDockerfileContent+="\n#Define Volume(s) = directories that persist during updates. Example:\n";
        newDockerfileContent+="#RUN mkdir /app/db\n";
        newDockerfileContent+="# You should also give the volume a name when starting the docker container via -v myNamedVolume:/app/db to make it persistent in case the **outer** container (i.e. 'deploy-node-anywhere-autopuller') is re-created\n";
        newDockerfileContent+="#VOLUME /app/db\n\n";

        // Start:
        if(!packageJson.scripts?.start) {
            throw new UsageError(`No "start" script found in ${packageJsonPath}. Please define one, so the target knows how to start the app.`)
        }
        newDockerfileContent+="# Start it:\n";
        newDockerfileContent+="ENV NODE_ENV=production\n";
        newDockerfileContent+="CMD npm run start\n"

        fs.writeFileSync(dockerFilePath, newDockerfileContent, {encoding: "utf8"});
    }
    else {
        if(isFistRun) {
            state.diagnosis_existingDockerfileSeenOnFirstRun = true;
        }
    }
    saveState();

    try {
        preStructreAndValidateDockerFile(dockerFilePath, sourceDir, config.allowRunCommands || false);
    }
    catch(e) {
        if(state.diagnosis_existingDockerfileSeenOnFirstRun) {
            (e as Error).message += `. Hint: You can let deploy-node-anywhere create a working default Dockerfile for you by deleting it and running again.`
        }
        throw e;
    }

    // Create seed key (or read existing from file):
    const pemFile = `${stateDir}/secret.pem`;
    let seedkey: Uint8Array;
    if(fs.existsSync(pemFile)) {
        seedkey = pem.decode(fs.readFileSync(pemFile))!;
        // Validity check:
        if(seedkey.length != 32) {
            throw new Error(`Invalid file: ${pemFile}`);
        }
    }
    else {
        // Create a seed key:
        seedkey = nacl.randomBytes(32);
        fs.writeFileSync(pemFile, pem.encode(Buffer.from(seedkey), "SEED KEY"), {encoding: "utf8"});
    }
    // Create keys:.
    const {publicKey, secretKey} = nacl.box.keyPair.fromSecretKey(seed);


    // command line:
    // -----------------
    // docker run -d --restart=unless-stopped dna-autopull  KiK9xt/oX93As3NX2cMqVEhb9juIIY7McxkQfci6u1w= -p 123:456 -v myVol:... -e
    //                                                      ^^^^^^^^^                                       ^^^
    //                                                      OR USE THIS TYPING FRIENDLY KEY: 1234344        Adjust the host port
    //

    // TODO: connect to autopuller

    // TODO: retrieve hash of current node image version from what's running in the autopuller and modify the Dockerfile (if there's still the line "FROM node\n"



    const packageName = getPackageName(sourceDir);

}

const NPM_CI_COMMAND_LINE = "npm ci --ignore-scripts --only=production";

function preStructreAndValidateDockerFile(dockerFilePath: string, sourceDir: string, allowRunCommands: boolean) {
    const parsedDockerFileContent = parseDockerFile(fs.readFileSync(dockerFilePath, {encoding: "utf8"}), {includeComments: false});
    type Result = {
        from: string
        workdir?: string;
        buildInstructions: CommandEntry[];
        env: Record<string, string>;
        cmd: CommandEntry;
        volumes: string[]
    };
    const result: Partial<Result> = {buildInstructions: [], env: {}, volumes: []};

    parsedDockerFileContent.forEach(commandEntry => {
        try {
            if (commandEntry.error) {
                throw new UsageError(`${commandEntry.error}`)
            }
            if (commandEntry.name === "FROM") {
                if (result.from) {
                    throw new UsageError(`Duplicate "FROM" command`);
                }
                if(!commandEntry.args || typeof commandEntry.args !== "string") {
                    throw new UsageError(`Invalid line: ${commandEntry.raw}`)
                }
                result.from = commandEntry.args;
            }
            else if(commandEntry.name === "WORKDIR") {
                if(!commandEntry.args || typeof commandEntry.args !== "string") {
                    throw new UsageError(`Invalid line: ${commandEntry.raw}`)
                }
                if (result.workdir) {
                    throw new UsageError(`Duplicate "WORKDIR" command. There can be only one, placed **before** all COPY/RUN commands`);
                }
                if(result.buildInstructions!.length > 0) {
                    throw new UsageError(`"WORKDIR" command must be placed **before** all COPY/RUN commands`)
                }
                result.workdir = commandEntry.args;
            }
            else if(commandEntry.name === "COPY") {
                result.buildInstructions!.push(commandEntry);
            }
            else if(commandEntry.name === "RUN") {
                const isMKdir = (typeof commandEntry.args === "string" && commandEntry.args.startsWith("mkdir")) || (Array.isArray(commandEntry.args) && commandEntry.args.length > 0 && commandEntry.args[0] === "mkdir")
                if(!allowRunCommands && !(isMKdir || commandEntry.args === NPM_CI_COMMAND_LINE)) {
                    throw new UsageError(`RUN commands (except "RUN ${NPM_CI_COMMAND_LINE}" and "RUN mkdir ...") are currently not supported by deploy-node-anywhere cause the autopuller cannot clean up changed system files inside the container on a re-deployment. You can still use it on your own risk with the --allow-run-commands option. Consider re-deploying the whole autopuller container then.`); // TODO: link to github issue
                }
                result.buildInstructions!.push(commandEntry);
            }
            else if(commandEntry.name === "ENV") {
                if(!commandEntry.args || typeof commandEntry.args !== "object") {
                    throw new UsageError(`Invalid line: ${commandEntry.raw}`)
                }
                result.env = {...result.env, ... commandEntry.args as Record<string, string>}; // add to result
            }
            else if(commandEntry.name === "CMD") {
                if (result.cmd) {
                    throw new UsageError(`Duplicate "CMD" command`);
                }
                result.cmd = commandEntry;
            }
            else if(commandEntry.name === "VOLUME") {
                if(Array.isArray(commandEntry.args)) {
                    result.volumes!.push(...commandEntry.args);
                }
                else if (typeof commandEntry.args === "string"){
                    result.volumes!.push(commandEntry.args);
                }
                else {
                    throw new UsageError(`Invalid line: ${commandEntry.raw}`)
                }
            }
            else {
                throw new UsageError(`The Command ${commandEntry.name} is not supported by deploy-node-anywhere.`)
            }
        }
        catch (e) {
            if(e instanceof UsageError) {
                e.message+= ` in Dockerfile, Line ${commandEntry.lineno}`;
            }
            throw e;
        }
    });

    // Validity check result.from:
    if(!result.from) {
        throw new UsageError(`No "FROM" specified in Dockerfile. Please insert the line "FROM node" at the top.`)
    }
    if(!result.from.match(/^node(@.*)?$/)) {
        throw new UsageError(`Invalid base image specified: ${result.from}. Deploy-node-anywhere only supports "node" as base image, cause the autopuller is based on that image. Please change the line inside your Dockerfile to "FROM node" or to "FROM node:@..."`);
    }

    // Validity check result.cmd
    if(!result.cmd) {
        throw new UsageError(`No "CMD" specified in Dockerfile. Usually you would want a line "CMD npm run start" at the bottom of your dockerfile`);
    }

    return result as Result;
}

function getPackageName(sourcePath: string): string {
    // read package.json:
    const packageJsonPath = `${sourcePath}/package.json`;
    let result;
    if(!fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, {encoding: "utf8"}));
        return packageJson.name;
    }
    return path.basename(sourcePath);
}

/**
 * Exits the programm and shows just the error message without stacktrace
 */
export class UsageError extends Error{

}