import http from 'http';
import WebSocket from 'ws-subprotocol-fix';
import chalk from 'chalk';
import util from 'util';
import {pathToFileURL} from 'url'

let config = {
    port: 6789,
    quiet: false,
    logStream: undefined
}

let wsClient = null;
let messages = [];
let newMessageCallback = null;
let messageTimeout = null;
let isConnected = false;

const requestListener = function (req, res) {
    if (req.method != "GET") {
        res.writeHead(400);
        res.end("Only GET method is supported");
        return;
    }

    let url = new URL(req.url, `http://${req.headers.host}`);

    switch (url.pathname.slice(1)) {
        case "connect": {
            if (wsClient || isConnected) {
                if (wsClient)
                    wsClient.close();
                wsClient = null;
                isConnected = false;
                console.log(`${chalk.green("(WebSocket Proxy)")} Closing WebSocket because of new connection`);
                config.logStream?.write(`(WebSocket Proxy) Closing WebSocket because of new connection\n`);
            }

            messages.length = [];
            newMessageCallback = null;
            let responded = false;

            const hostQuery = url.searchParams.get("host");
            if (!hostQuery) {
                res.writeHead(400);
                res.end("\"host\" query parameter is missing");
                return;
            }

            const tokenQuery = url.searchParams.get("token");
            if (!tokenQuery) {
                res.writeHead(400);
                res.end("\"token\" query parameter is missing");
                return;
            }

            const subprotocolQuery = url.searchParams.get("subprotocol");

            const subprotocol = subprotocolQuery ?? undefined;

            wsClient = new WebSocket(`${hostQuery.replace("http", "ws")}?token=${tokenQuery}`, subprotocol, {
                headers: {
                    "Authorization": `Bearer ${tokenQuery}`
                },
                ignoreSubprotocolErrors: true,
                rejectUnauthorized: false
            });

            wsClient.on('open', function open() {
                if (isConnected || responded)
                    return;

                console.log(`${chalk.green("(WebSocket Proxy)")} Connected to WebSocket! URL: ${chalk.green(hostQuery)}`);
                config.logStream?.write(`(WebSocket Proxy) Connected to WebSocket! URL: ${hostQuery}\n`);
                
                responded = true;
                isConnected = true;

                res.writeHead(200);
                res.end("Successfully connected to WebSocket");
            });

            wsClient.on('error', function error(ws) {
                console.error(`${chalk.green("(WebSocket Proxy)")} WebSocket error: ${ws.message}`);
                config.logStream?.write(`(WebSocket Proxy) WebSocket error: ${ws.message}\n`);

                isConnected = false;
                wsClient = null;

                if (responded)
                    return;

                responded = true;
                res.writeHead(400);
                res.end(`WebSocket error: ${ws.message}`);
            });

            wsClient.on('close', function error(ws) {
            
            	if(ws == wsClient) {
                    isConnected = false;
                    wsClient = null;
                    console.log(`${chalk.green("(WebSocket Proxy)")} Current WebSocket closed`);
                    config.logStream?.write(`(WebSocket Proxy) Current WebSocket closed\n`);
                } else {
                    console.log(`${chalk.green("(WebSocket Proxy)")} Old WebSocket closed`);
                    config.logStream?.write(`(WebSocket Proxy) Old WebSocket closed\n`);
                }

                
                if (responded)
                    return;

                responded = true;
                res.writeHead(400);
                res.end("WebSocket closed");
            });

            wsClient.on('message', onMessage);
        } return;

        case "disconnect": {
            if (!wsClient || !isConnected) {
                res.writeHead(200);
                res.end("Not connected");
                console.log(`${chalk.red("Not connected!")} Reason: ${wsClient == null ? "WS closed" : "Flag not set"}`);
                config.logStream?.write(`Not connected! Reason: ${wsClient == null ? "WS closed" : "Flag not set"}\n`);
                return;
            }

            wsClient.close();
            wsClient = null;
            isConnected = false;
            res.writeHead(200);
            res.end("Successfully disconnected from WebSocket");
        } return;

        case "await": {        
            if (!wsClient || !isConnected) {
                res.writeHead(400);
                res.end("Not connected");
                console.log(`${chalk.red("Not connected!")} Reason: ${wsClient == null ? "WS closed" : "Flag not set"}`);
                config.logStream?.write(`Not connected! Reason: ${wsClient == null ? "WS closed" : "Flag not set"}\n`);
                return;
            }

            const timeFromQuery = url.searchParams.get("timeFrom");
            const timeoutQuery = url.searchParams.get("timeout");

            const conditions = Array.from(url.searchParams.entries())
                .filter(p => p[0].startsWith('C_'))
                .map(p => {
                    var condition = { path: p[0].slice(2), regex: p[1] };
                    return condition;
                });

            const timeFrom = timeFromQuery ? parseInt(timeFromQuery) : Date.now();
            const timeout = timeoutQuery ? parseInt(timeoutQuery) : 90000;

            if (!config.quiet)
                console.log(`\n----------\nSearching for message from ${new Date(timeFrom)} (${timeFrom})...\nConditions: ${util.inspect(conditions, { colors: true, depth: null })}\n----------`);

            config.logStream?.write(`\n----------\nSearching for message from ${new Date(timeFrom)} (${timeFrom})...\nConditions: ${util.inspect(conditions, { colors: false, depth: null })}\n----------\n`);

            let prevMessage = messages.find(msg => (msg.time >= timeFrom && checkConditions(conditions, msg.body, false)));

            if (prevMessage) {
                if (!config.quiet)
                    console.log(`Matching message found in history! Time: ${prevMessage.time} (${prevMessage.time.getTime()})`);
                config.logStream?.write(`Matching message found in history! Time: ${prevMessage.time} (${prevMessage.time.getTime()})\n`);


                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(prevMessage.body));
            }
            else {

                if (newMessageCallback != null) {
                    console.error(chalk.magenta("\n----------\nAnother message is already awaited\n----------"));
                    config.logStream?.write(`\n----------\nAnother message is already awaited\n----------\n`);

                    res.writeHead(400);
                    res.end("Another message is already awaited");
                    return;
                }

                newMessageCallback = function (msg) {

                    if (msg === undefined) {
                        clearTimeout(messageTimeout);
                        newMessageCallback = null;
                        console.error(chalk.magenta("\n----------\nAwait timed out\n----------"));
                        config.logStream?.write(`\n----------\nAwait timed out\n----------\n`);

                        res.writeHead(408);
                        res.end("Await timed out");
                    }
                    else if (checkConditions(conditions, msg, !config.quiet)) {
                        clearTimeout(messageTimeout);
                        newMessageCallback = null;

                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify(msg));
                    }
                }

                messageTimeout = setTimeout(newMessageCallback, timeout, undefined);
            }
        } return;
    }

    res.writeHead(404);
    res.end("Path not found");
};

const onMessage = function (message) {
    if (message) {
        const bodyString = message.toString();
        const body = JSON.parse(bodyString);
        const unixTime = Date.now();
        const time = new Date(unixTime);

        if (!config.quiet)
            console.log(`\n----------\nNew message at ${time} (${unixTime}):\n${util.inspect(body, { colors: true, depth: null }) ?? bodyString}\n----------`);
        config.logStream?.write(`\n----------\nNew message at ${time} (${unixTime}):\n${util.inspect(body, { colors: false, depth: null }) ?? bodyString}\n----------\n`);

        if (newMessageCallback)
            newMessageCallback(body);

        messages.push({ time: time, body: body });

    } else {
        if (!config.quiet)
            console.log(chalk.yellow(`\n----------\nNew empty message at ${new Date()} (${Date.now()})\n----------`));
        config.logStream?.write(`\n----------\nNew empty message at ${new Date()} (${Date.now()})\n----------\n`);
    }
};

const checkConditions = function (conditions, msg, shouldLog) {
    return conditions.every(c => {
        let value = c.path.split('.').reduce((o, i) => (o == undefined || !o.hasOwnProperty(i)) ? undefined : o[i], msg);
        const match = new RegExp(c.regex).test(value);

        if (shouldLog)
            console.log(`${chalk.white('Check:')} Value of path '${chalk.yellow(c.path)}' should match '${chalk.yellow(c.regex)}', value: '${chalk.yellow(value)}', matched: ${match ? chalk.green(match) : chalk.red(match)}`);

        config.logStream?.write(`Check: Value of path '${c.path}' should match '${c.regex}', value: '${value}', matched: ${match}\n`);

        return match;
    });
}

const server = http.createServer(requestListener);

const startProxy = function () {
    server.listen(config.port, "0.0.0.0", () => {
        console.log(`${chalk.green("(WebSocket Proxy)")} Server is running at port ${config.port}!`);
        config.logStream?.write(`(WebSocket Proxy) Server is running at port ${config.port}!\n`);

    });
}

const stopProxy = function () {
    server.close();
}

function isScript() {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isScript()) {
    startProxy();
}

export default {
    config,
    startProxy,
    stopProxy
}
