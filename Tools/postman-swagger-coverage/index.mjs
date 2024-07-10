import fs from 'fs-extra';
import { createRegExp, oneOrMore, exactly, wordChar, global } from 'magic-regexp';
import tb from 'thenby';
import { Command } from 'commander';
import chalk from 'chalk';
import { exit } from 'process';

//Parse command line arguments
const program = new Command();
program
    .option('-c, --collections <paths...>', 'paths to Postman collection')
    .option('-a, --openapi <path>', 'path to OpenAPI v3 specification')
    .option('-o, --output <path>', 'path to the resulting specification')
    .option('-s, --settings <path>', 'path to the config file', 'config.json')
    .option('-q, --quiet', 'quiet mode')
program.parse(process.argv);
const options = program.opts();

let collections = options.collections;
let openapi = options.openapi;
let output = options.output;
let quiet = options.quiet;

if (options.settings) {
    try {
        const config = fs.readJsonSync(options.settings);

        if (config.collectionPaths && !collections)
            collections = config.collectionPaths;
        if (config.openapiSpecPath && !openapi)
            openapi = config.openapiSpecPath;
        if (config.outputPath && !output)
            output = config.outputPath;
        if (config.quiet && !quiet)
            quiet = config.quiet;
    } catch (ex) {
        console.warn(`Unable to read config, error: ${ex}`);
    }
}

if(!collections || collections.length == 0 || collections.every(x => !x || x.length == 0)) {
    console.error('No collections provided');
    exit();
}
if(!openapi || openapi.length == 0) {
    console.error('No OpenAPI v3 specification provided');
    exit();
}
if(!output || output.length == 0) {
    console.error('No output path provided');
    exit();
}

const spec = fs.readJsonSync(openapi);

const findTemplateRegExp = createRegExp(exactly('{').and(oneOrMore(wordChar)).and(exactly('}')), [global]);

let collectionRequests = [];

for (let collectionPath of collections) {
    const collection = fs.readJsonSync(collectionPath);
    collectionRequests = [...collectionRequests, ...getAllRequests(collection, collection.info.name)];
}

function getAllRequests(coll, parentName) {

    if (coll.item == null) {
        coll.parentName = parentName;
        return [coll];
    }

    let requests = [];

    for (var child of coll.item) {
        requests = [...requests, ...getAllRequests(child, `${parentName}${parentName && parentName.length > 0 ? "/" : ""}${coll.name ?? ""}`)];
    }

    return requests;
}

let paths = Object.keys(spec.paths).sort(tb.firstBy((x, y) => y.split('/').length - x.split('/').length).thenBy((x, y) => -x.localeCompare(y)));

let apiDefinitions = [];

for (var path of paths) {
    let regExpString = path.replace(findTemplateRegExp, '[^\?]+').replace('/0/', '\/[^\?]+\/'); //second replace is for SL-10 api
    let regExp = new RegExp(regExpString);

    apiDefinitions.push({ path, regExp });

    for (var method in spec.paths[path]) {
        spec.paths[path][method]['coverage'] = [];
    }
}

let checkedRequests = 0;

let nonCoveringRequests = [];

for (var req of collectionRequests) {
    let didCoverSomething = false

    for (var def of apiDefinitions) {
        if (def.regExp.test(req.request.url.raw)) {
            var apiCall = spec.paths[def.path][req.request.method.toLowerCase()];

            let reqName = `${req.parentName}/${req.name}`;

            if (apiCall == null) {
                if (!quiet)
                    console.warn(chalk.red(`Request \"${reqName}\" (Method: ${req.request.method}, URL: ${req.request.url.raw}) not found in OpenAPI spec`));
                continue;
            }

            apiCall.coverage.push(reqName);

            if (!quiet)
                console.log(chalk.green(`Definition (${def.path}) covered by request "${reqName}" (Method: ${req.request.method}, URL: ${req.request.url.raw})`));
            checkedRequests++;
            didCoverSomething = true;

            break;
        }
    }

    if (!didCoverSomething) {
        nonCoveringRequests.push(req);
    }
}

if (!options.quiet) {
    console.log('');
    console.log(chalk.green(`${checkedRequests}/${collectionRequests.length} requests are covering some definition`));
    for (let req of nonCoveringRequests) {
        console.warn(chalk.red(`Request "${req.parentName}/${req.name}" (Method: ${req.request.method}, URL: ${req.request.url.raw}) didn't cover anything`));
    }
}

fs.writeJsonSync(output, spec);
console.log(chalk.green('Done!'));