import * as path from "node:path"
import * as fs from "node:fs";
import {deployNodeAnywhere} from "../../deploy-node-anywhere/deployNodeAnywhere";
jest.setTimeout(60 * 60 * 1000); // Increase timeout to 1h to make debugging possible

let integrationTestDir: string
const tempDir = "./temp";
beforeAll(() => {
    integrationTestDir = path.resolve(".");
});
beforeEach(() => {
    process.chdir(integrationTestDir); // restore
    // Clean temp dir:
    if(fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, {recursive: true});
    }
    fs.mkdirSync(tempDir);

})

test("Deploy example app", () => {
    fs.cpSync("example-app", `${tempDir}/example-app`, {recursive: true});
    process.chdir(`${tempDir}/example-app`);
    deployNodeAnywhere({});
});