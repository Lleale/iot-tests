#!/usr/bin/env zx

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

import _ from 'lodash';
import got from 'got';
import newman from 'newman';
import util from 'util';
import { Command } from 'commander';
import zway from 'iot-simulate-zway/zway-simulator.js';
import wsProxy from 'postman-websocket-proxy';
import zwaveCtl from 'zwave-ctl-sim';
import mongoProxy from 'postman-mongo-proxy';
import stripAnsiStream from 'strip-ansi-stream';
import { MongoClient } from 'mongodb'

process.on('uncaughtException', function (ex) {
    fatalError(ex);
});

//Parse command line arguments
const program = new Command();
program
    .option('-c, --collection <path>', 'path to Postman collection (read only)')
    .option('-g, --globals <path>', 'path to Postman globals (read only)')
    .option('-e, --environment <path>', 'path to Postman environment (read/write)')
    .option('-r, --report <path>', 'path to the resulting report folder')
    .option('-o, --config <path>', 'path to config file')
    .option('--skipCleanup', 'don\'t clean up report folder and cloned repo\'s folder before test')
    .option('--junit', 'generate JUnit report')
    .option('--host <ip or domain>', 'specify host')
    .option('--apiPort <ip or domain>', 'specify API port')
    .option('--zwaySimulate', 'start zway-simulate script before tests')
    .option('--logToFile', 'write test stand logs to file');
program.parse(process.argv);
const options = program.opts();
const configPath = options.config ?? 'config.json';
const config = await fs.readJson(configPath);

//Set test start date and time
const testStartDatePostfix = new Date().toISOString().replace('T', '_').replace('Z', '');

//Newman test files paths
const collectionPath = options.collection ?? config.collectionPath;
const globalsPath = options.globals ?? config.globalsPath;
const customEnvironment = !!(options.environment || config.environmentPath)
const environmentPath = options.environment ?? config.environmentPath ?? 'stand.postman_environment.json';

const saveInHistory = config.saveReportsInHistory;
let historyPath;
if (saveInHistory)
    historyPath = config.reportsHistoryPath ?? "oldReports";

const compressReport = config.compressReport;
let archivePath;
if (compressReport)
    archivePath = config.reportArchivePath ?? "report.tar.xz";

//Check additional arguments
const host = options.host ?? config.host;
const apiPort = options.apiPort ?? config.apiPort;
const originalReportFolder = options.report ?? config.reportPath;
const skipCleanup = options.skipCleanup;
const junitReport = options.junit ?? config.generateJUnitReport;
const zwaySimulate = options.zwaySimulate ?? config.startZwaySimulate;
const logToFile = options.logToFile ?? config.logToFile ?? false;
const takeDbSnapshotsOnFailures = config.takeDbSnapshotsOnFailures ?? false;
const dbAddress = config.dbAddress;
const dbName = config.dbName;

//Clean up
if (!skipCleanup) {
    console.log('Cleaning up...');
    await fs.rm(originalReportFolder, { recursive: true, force: true });

    if (!customEnvironment && await fs.exists(environmentPath))
        await fs.rm(environmentPath);
}

//Modify variables in globals file
function replaceValue(key, newValue) {
    let pair = globalsJson.values.find(x => x.key == key);
    if (pair)
        pair.value = newValue;
}

let globalsJson = await fs.readJson(globalsPath)
replaceValue('host', `http://${host}:${apiPort}/api/v1`);
replaceValue('websocket_proxy_host', `http://localhost:${wsProxy.config.port}`);
replaceValue('zway_ctl_host', `http://localhost:${zwaveCtl.config.port}`);
replaceValue('mqtt_sim_host', `http://localhost:5005`);

//Get platform info
console.log(`Trying to get platform info for ${chalk.green(host)}`);

let versionJson = await got(`http://${host}:${apiPort}/api/v1/version`, {
    retry: {
        limit: 600,
        statusCodes: [502],
        errorCodes: ['ERR_NON_2XX_3XX_RESPONSE', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'],
        backoffLimit: 1500,
    }
}).json();
let infoJson = await got(`http://${host}:${apiPort}/api/v1/info`, {
    retry: {
        limit: 600,
        statusCodes: [502],
        errorCodes: ['ERR_NON_2XX_3XX_RESPONSE', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'],
        backoffLimit: 1500,
    }
}).json();
const platformVersion = versionJson.version;
const platformType = platformVersion.includes('b') ? "SL-10" : "IoT-Core";
const reportName = `${platformType}: ${platformVersion}`;
const reportPostfix = `${testStartDatePostfix}_${platformVersion}`;
const ctlGatePort = infoJson.ctlGatePort;

//Create folder for report
const reportFolder = path.join(originalReportFolder, reportPostfix);
await fs.mkdir(reportFolder, { recursive: true });

let dbClient = undefined;
let coreDb = undefined;

try {
    //Logging
    if (logToFile) {
        var access = fs.createWriteStream(path.join(reportFolder, `test-stand-${reportPostfix}.log`), { flags: 'w' });
        var textStream = stripAnsiStream();
        textStream.pipe(access);

        const origStdout = process.stdout.write;
        const origStderr = process.stderr.write;
        function splitStdout() {
            origStdout.apply(process.stdout, arguments);
            textStream.write.apply(textStream, arguments);
        }
        function splitStderr() {
            origStderr.apply(process.stderr, arguments);
            textStream.write.apply(textStream, arguments);
        }
        process.stdout.write = splitStdout;
        process.stderr.write = splitStderr;
    }

    console.log(`Platform type and version: ${chalk.green(platformType)} ${chalk.green(platformVersion)}`);
    console.log(`API port: ${chalk.green(apiPort)}, Controller gate port ${chalk.green(ctlGatePort)}`);

    //Newman reporters configuration
    const htmlextraTemplatePath = 'report-template.hbs'
    const htmlextraExportPath = `newman-report-${reportPostfix}.html`
    const junitExportPath = `junit-report-${reportPostfix}.xml`
    const allureReportName = `allure-report-${reportPostfix}`;

    //Set newman reporters list
    let reporters = ['htmlextra', 'allure', 'cli'];
    if (junitReport)
        reporters.push('junit');

    //Start zway-simulate if needed
    if (zwaySimulate) {
        console.log('Starting zway-simulate script...');
        zway.config.connect_IP = `ws://${host}:${ctlGatePort}`;
        zway.config.quiet = true;
        zway.startAllConnections();
    }

    //Start WebSocket proxy
    console.log('Starting WebSocket proxy...');
    wsProxy.config.quiet = true;
    wsProxy.config.logStream = fs.createWriteStream(path.join(reportFolder, `websocket-${reportPostfix}.log`), { flags: 'w' });
    wsProxy.startProxy();

    //Start Z-Wave Controller Simulator
    console.log('Starting Z-Wave Controller Simulator...');
    zwaveCtl.config.quiet = true;
    zwaveCtl.startCtl();

    //Start SW_RLY01_sim
    console.log('Starting SW_RLY01 Simulator...');
    let rlySimProcess = $`./libraries/SW_RLY01_sim/SW_RLY01_sim.bin`.nothrow();

    //Start mediamtx
    console.log('Starting mediamtx ...');
    let mediamtx = $`./libraries/cam_simulator/cam_simulator/mediamtx /home/cicd/stand/cloned/test-stand/libraries/cam_simulator/cam_simulator/mediamtx.yml`.nothrow()

    //Start cam_simulator
    console.log('Starting cam_simulator ...');
    let cam_simulator = $`./libraries/cam_simulator/cam_simulator/main.bin -c ./libraries/cam_simulator/cam_simulator/config.ini`.nothrow()

    // Start postman-logs-proxy
    console.log('Starting postman-logs-proxy...');
    let postman_logs_proxy_Process = $`./libraries/postman-logs-proxy/postman-logs-proxy.bin`.nothrow()
    
    // Start postman-mongo-proxy
    console.log('Starting postman-mongo-proxy...');
    mongoProxy.startProxy();

    if (takeDbSnapshotsOnFailures) {
        //Connect to DB
        dbClient = new MongoClient(dbAddress);
        console.log('Connecting to DB...');
        await dbClient.connect();
        coreDb = dbClient.db(dbName);
    }

    //Start tests
    console.log('Starting tests...');

    var resolveResult, rejectResult;
    let newmanEvents = newman.run({
        collection: collectionPath,
        globals: globalsJson,
        environment: customEnvironment ? environmentPath : undefined,
        exportEnvironment: environmentPath,
        reporters: reporters,
        reporter: {
            htmlextra:
            {
                export: path.join(reportFolder, htmlextraExportPath),
                template: htmlextraTemplatePath,
                title: reportName,
                titleSize: 6
            },
            allure: {
                export: path.join(reportFolder, 'allure-results'),
                ...(takeDbSnapshotsOnFailures ? { onAssertFailed: allureAttachDbSnapshot.bind(this) } : {})
            },
            junit: {
                export: path.join(reportFolder, junitExportPath),
            }
        }
    }, (err, result) => {
        if (err)
            rejectResult(err);
        else
            resolveResult(result);
    });

    newmanEvents.on('error', (ex) => rejectResult(ex));

    let result = await new Promise((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
    });


    if (takeDbSnapshotsOnFailures) {
        //Disconnect to DB
        console.log('Disconnecting from DB...');
        await dbClient.close();
    }

    //Stop WebSocket proxy
    console.log('Stopping WebSocket proxy...');
    wsProxy.stopProxy();
    wsProxy.config.logStream.end();

    //Stop Z-Wave Controller Simulator
    console.log('Stopping Z-Wave Controller Simulator...');
    zwaveCtl.stopCtl();

    //Stop SW_RLY01 Simulator
    console.log('Stopping Z-SW_RLY01 Simulator...');
    await rlySimProcess.kill();

    //Stop postman_logs_proxy 
    console.log('Stopping postman_logs_proxy...');
    await postman_logs_proxy_Process.kill();

    // Start postman-mongo-proxy
    console.log('Stopping postman-mongo-proxy...');
    mongoProxy.stopProxy();

    //Stop zway-simulate script if running
    if (zwaySimulate) {
        console.log('Stopping zway-simulate script...');
        zway.stopAllConnections();
    }

    //Stop cam_simulator 
    console.log('Stopping cam_simulator...');
    await cam_simulator.kill();
//    await $`kill -9 $(lsof -i :1337 | tail -n1 | awk '{print $2}')`.nothrow()

    //Stop mediamtx 
    console.log('Stopping mediamtx...');
    await mediamtx.kill();
//    await $`kill -9 $(lsof -i :8000 | tail -n1 | awk '{print $2}')`.nothrow()
//    await $`kill -9 $(ps a | grep ffmpeg | grep 1234 | awk '{print $1}')`.nothrow()
    


    //Save environemnt variables to allure-results
    console.log('Saving environment variables for Allure report...');
    let environmentJson = await fs.readJson(environmentPath)
    let environmentData = environmentJson.values.reduce((acc, current) => acc += `${current.key}=${current.value}\n`, '')
    await fs.writeFile(path.join(reportFolder, 'allure-results', 'environment.properties'), environmentData);

    //Generate Allure report
    console.log('Preparing Allure report...');
    await $`allure generate ${path.join(reportFolder, 'allure-results')} -o ${path.join(reportFolder, allureReportName)}`;
    await fs.rm(path.join(reportFolder, 'allure-results'), { recursive: true, force: true });

    //Modify Allure report
    let allureSummaryPath = path.join(reportFolder, allureReportName, 'widgets', 'summary.json');
    let allureSummary = await fs.readJson(allureSummaryPath);
    allureSummary.reportName = reportName + '  Date:';
    await fs.writeJson(allureSummaryPath, allureSummary);

    //Add assertions count to Allure report
    //Not very reliable, but the alternative is to rebuild Allure Generator
    const testCasesEndPattern = '        </div>\\n    </div>\\n    <div class="\'';
    const assertionsTemplate = `<div class="summary-widget__stats splash">\\n<div class="splash__title">${result.run.stats.assertions.total}</div>\\n<div class="splash__subtitle">assertions</div>\\n</div>`;

    let allureAppPath = path.join(reportFolder, allureReportName, 'app.js');
    let allureApp = (await fs.readFile(allureAppPath)).toString();
    allureApp = allureApp.replace(testCasesEndPattern, `</div>${assertionsTemplate}<div>${testCasesEndPattern}`);
    await fs.writeFile(allureAppPath, allureApp);

    //Saving report in history
    if (saveInHistory) {
        console.log('Saving report in history...');
        await fs.mkdir(historyPath, { recursive: true });
        await fs.copySync(reportFolder, path.join(historyPath, reportPostfix + (result.run.stats.assertions.failed == 0 ? "-PASS" : "-FAIL")), { recursive: true });
    }

    //Compressing report
    if (compressReport) {
        console.log('Compressing report...');
        await $`tar -cJf ${archivePath} ${reportFolder}`;
    }

    console.log('Отчеты доступны по адресу:');
    console.log(`http://10.24.64.12:8099/${reportPostfix}`);

    //Quit with the correct exit code
    if (result.run.stats.assertions.failed == 0) {
        console.log(chalk.green('-- Run finished without assertion failures! --'));
    } else {
        console.log(chalk.red(`-- Run finished with ${result.run.stats.assertions.failed} assertion failures! --`));
        process.exitCode = 1;
    }
}
catch (ex) {
    fatalError(ex);
}

function fatalError(ex) {
    console.error(chalk.red("---- UNHANDLED EXCEPTION ----"));
    console.error(ex);

    try {
    	fs.writeFileSync(path.join(reportFolder, 'error.log'), `Unhandled exception: ${ex}`);
    
        //Saving report before crash
        if (saveInHistory) {
            console.log('Saving report in history...');
            fs.mkdirSync(historyPath, { recursive: true });
            fs.copySync(reportFolder, path.join(historyPath, (reportPostfix ?? testStartDatePostfix) + "-CRASH"), { recursive: true });

            console.log(chalk.green('Successfully saved crash report'));
        }
    } catch (exception) {
        console.error(chalk.red('Failed to save crash report:'));
        console.error(exception);
    }

    if (typeof wsProxy !== 'undefined') {
        try {
            //Stop WebSocket proxy
            console.log('Stopping WebSocket proxy...');
            wsProxy.stopProxy();
            wsProxy.config.logStream.end();
            console.log(chalk.green('Successfully stopped WebSocket proxy'));
        } catch (exception) {
            console.error(chalk.red('Failed to stop WebSocket proxy'));
            console.error(exception);
        }
    }

    if (typeof zwaveCtl !== 'undefined') {
        try {
            //Stop Z-Wave Controller Simulator
            console.log('Stopping Z-Wave Controller Simulator...');
            zwaveCtl.stopCtl();
            console.log(chalk.green('Successfully stopped Z-Wave Controller Simulator'));
        } catch (exception) {
            console.error(chalk.red('Failed to stop Z-Wave Controller Simulator'));
            console.error(exception);
        }
    }

    if (typeof rlySimProcess !== 'undefined') {
        try {
            //Stop SW_RLY01 Simulator
            console.log('Stopping SW_RLY01 Simulator...');
            rlySimProcess.kill();
            console.log(chalk.green('Successfully stopped SW_RLY01 Simulator'));
        } catch (exception) {
            console.error(chalk.red('Failed to stop SW_RLY01 Simulator'));
            console.error(exception);
        }
    }

    //Stop zway-simulate script if running
    if (zwaySimulate && typeof zway !== 'undefined') {
        try {
            console.log('Stopping zway-simulate script...');
            zway.stopAllConnections();
            console.log(chalk.green('Successfully stopped zway-simulate script'));
        } catch (exception) {
            console.error(chalk.red('Failed to stop zway-simulate script'));
            console.error(exception);
        }
    }

    if (typeof cam_simulator !== 'undefined') {
        try {
            //Stop cam_simulator Simulator
            console.log('Stopping cam_simulator Simulator...');
            cam_simulator.kill();
            console.log(chalk.green('Successfully stopped cam_simulator Simulator'));
        } catch (exception) {
            console.error(chalk.red('Failed to stop cam_simulator Simulator'));
            console.error(exception);
        }
    }

    if (typeof postman_logs_proxy_Process !== 'undefined') {
        try {
            //Stop postman_logs_proxy Simulator
            console.log('Stopping postman_logs_proxy Simulator...');
            postman_logs_proxy_Process.kill();
            console.log(chalk.green('Successfully stopped postman_logs_proxy Simulator'));
        } catch (exception) {
            console.error(chalk.red('Failed to stop postman_logs_proxy Simulator'));
            console.error(exception);
        }
    }

    if (typeof mongoProxy !== 'undefined') {
        try {
            //Stop postman-mongo-proxy
            console.log('Stopping postman-mongo-proxy...');
            mongoProxy.stopProxy();
            console.log(chalk.green('Successfully stopped postman-mongo-proxy'));
        } catch (exception) {
            console.error(chalk.red('Failed to stop postman-mongo-proxy'));
            console.error(exception);
        }
    }

    process.exit(1);
}

async function allureAttachDbSnapshot(reporter, runningItem) {
    if (reporter !== undefined && takeDbSnapshotsOnFailures) {

        const dbCollections = reporter.options.environment.get('db_collections')?.split(',');

        if (!dbCollections) {
            console.log('Failed to attach DB snapshot, no collection is specified in "db_collection" environment variable');
            return;
        }

        for (let dbCollection of dbCollections) {
            console.log(`DB Collection to snapshot: ${dbCollection}`);
            const dbSnapshotString = JSON.stringify(await coreDb.collection(dbCollection).find({}).toArray(), null, 4);

            const buf = Buffer.from(dbSnapshotString, "utf8");
            const file = reporter.allure_runtime.writeAttachment(buf, "application/json");
            runningItem.allure_test.addAttachment(`db_snapshot_${dbCollection}`, "application/json", file);
            console.log(`Saved DB snapshot!`);
        }
    }
}
