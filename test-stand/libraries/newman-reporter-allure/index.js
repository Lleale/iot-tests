const AllureRuntime = require("allure-js-commons").AllureRuntime;
const isPromise = require("allure-js-commons").isPromise;
const Status = require("allure-js-commons").Status;
const LabelName = require("allure-js-commons").LabelName;
const Stage = require("allure-js-commons").Allure;
const createHash = require("crypto").createHash;
const _ = require('lodash');
// const WrappedStep = require("./src/WrappedStep");

class AllureReporter {
    constructor(emitter, reporterOptions, options) {
        this.suites = [];
        this.runningItems = [];
        this.currentNMGroup = options.collection;
        this.onAssertFailed = reporterOptions.onAssertFailed;
        var config = {
            resultsDir: reporterOptions.export || "allure-results"
        }
        this.allure_runtime = new AllureRuntime(config);
        this.reporterOptions = reporterOptions;
        this.options = options;
        const events = 'start beforeIteration iteration beforeItem item beforePrerequest prerequest beforeScript script beforeRequest request beforeTest test beforeAssertion assertion console exception beforeDone done'.split(' ');

        events.forEach((e) => {
            if (typeof this[e] == 'function') emitter.on(e, (err, args) => {
                try {
                    this[e](err, args);
                } catch (ex) {
                    emitter.emit('error', ex);
                    throw new Error(ex);
                }
            })
        });
    }


    get currentSuite() {
        if (this.suites.length === 0) {
            return null;
        }
        return this.suites[this.suites.length - 1];
    }

    get currentStep() {
        if (this.runningItems.length === 0)
            return null;
        if (!Array.isArray(this.runningItems[this.runningItems.length - 1].steps))
            return null;
        if (this.runningItems[this.runningItems.length - 1].steps.length === 0)
            return null;
        const steps = this.runningItems[this.runningItems.length - 1].steps;
        return steps[steps.length - 1];
    }


    get currentTest() {
        if (this.runningItems.length === 0) {
            console.warn("No active test, ignoring");
            return null;
        }
        const tests_size = this.runningItems.length;
        return this.runningItems[tests_size - 1].allure_test;
    }

    set currentTest(allure_test) {
        this.runningItems[this.runningItems.length - 1].allure_test = allure_test;
    }

    parseJwt(token) {
        try {
            if (!token || token.length == 0)
                return { error: "JWT is undefined, null, not a string or empty", sub: null };
            return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        } catch (ex) {
            return { error: ex, sub: null };
        }
    }

    writeAttachment(content, type) {
        return this.allure_runtime.writeAttachment(content, type);
    }


    pushSuite(suite) {
        this.suites.push(suite);
    }

    popSuite() {
        this.suites.pop();
    }

    start(err, args) {
        const suiteName = this.options.collection.name;
        const scope = this.currentSuite || this.allure_runtime;
        const suite = scope.startGroup(suiteName || "Global");
        this.pushSuite(suite);
        this.runningItems = [];
    }
    
    prerequest(err, args) {
        let i = 0;
        while (args.executions != undefined && _.isArray(args.executions) && args.executions.length > 0 && args.executions[this.runningItems.length + i] != undefined) i++;
        this.runningItems[this.runningItems.length - 1].pm_item.prerequest = args.executions[this.runningItems.length + i - 1].script.exec.join('\n');
    }

    test(err, args) {
        let i = 0;
        while (args.executions != undefined && _.isArray(args.executions) && args.executions.length > 0 && args.executions[this.runningItems.length + i] != undefined) i++;
        this.runningItems[this.runningItems.length - 1].pm_item.testscript = args.executions[this.runningItems.length + i - 1].script.exec.join('\n');
    }

    console(err, args) {
        if (err) { return; }
        if (args.level) {
            if (!Array.isArray(this.runningItems[this.runningItems.length - 1].pm_item.console_logs)) {
            if (!Array.isArray(this.runningItems[this.runningItems.length - 1].pm_item.console_logs)) {
                this.runningItems[this.runningItems.length - 1].pm_item.console_logs = [];
                this.runningItems[this.runningItems.length - 1].pm_item.console_logs.push(`level: ${args.level}, messages: ${args.messages}`);
            } else {
                this.runningItems[this.runningItems.length - 1].pm_item.console_logs.push(`level: ${args.level}, messages: ${args.messages}`);
            }
        }
        }
    }

    request(err, args) {
        if (err)
            return;
        const req = args.request;
        let url = req.url.protocol + "://" + req.url.host.join('.');
        if (req.url.path !== undefined) {
            if (req.url.path.length > 0) {
                url = url + "/" + req.url.path.join('/');
            }
        }
        const resp_stream = args.response.stream;
        const resp_body = Buffer.from(resp_stream).toString();
        this.runningItems[this.runningItems.length - 1].pm_item.request_data = { url: url, method: req.method, body: req.body, headers: req.headers };
        this.runningItems[this.runningItems.length - 1].pm_item.response_data = { status: args.response.status, code: args.response.code, body: resp_body };
    }

    startStep(name) {
    	if (!this.currentExecutable) {
    		return null;
    	}
        const allureStep = this.currentExecutable.startStep(name);
        this.pushStep(allureStep);
        return this;
        // return new WrappedStep(this, allureStep);
    }

    endStep(status) {
        let step = this.popStep();
        step.status = status;
        step.endStep();
    }

    assertion(err, args) {
        const stepName = args.assertion;
        const curStep = this.startStep(stepName);
        if (!curStep)
        	return;
        if (err) {
            this.runningItems[this.runningItems.length - 1].pm_item.passed = false;
            this.runningItems[this.runningItems.length - 1].pm_item.failedAssertions.push(args.assertion);
            curStep.endStep(Status.FAILED);
        } else {
            curStep.endStep(Status.PASSED);
        }
    }


    done(err, args) {
        if (this.currentSuite !== null) {
            // if (this.currentStep !== null) {
            //   this.currentStep.endStep();
            // }
            this.currentSuite.endGroup();
            this.popSuite();
        }
    }

    beforeItem(err, args) {
        let pm_item = { name: this.itemName(args.item, args.cursor), passed: true, failedAssertions: [], console_logs: [] };
        if (this.currentSuite === null) {
            throw new Error("No active suite");
        }
        var testName = pm_item.name;
        if (testName.indexOf("/") > 0) {
            const len = testName.split("/").length;
            testName = testName.split("/")[len - 1];
        }
        let testFullName = ''
        let allure_test = this.currentSuite.startTest(testName);
        testFullName = pm_item.name;
        const rndStr = Math.random().toString(36).substr(2, 5);
        testFullName = testFullName + '_' + rndStr;
        allure_test.historyId = createHash("md5")
            .update(testFullName)
            .digest("hex");

        allure_test.stage = Stage.RUNNING;
        var itemGroup = args.item.parent();
        var root = !itemGroup || (itemGroup === this.options.collection);
        var fullName = '';
        if (itemGroup && (this.currentNMGroup !== itemGroup)) {
            !root && (fullName = this.getFullName(itemGroup));
            this.currentNMGroup = itemGroup;
        }
        fullName = this.getFullName(this.currentNMGroup);
        var parentSuite, suite;
        var subSuites = [];
        if (fullName !== '') {
            if (fullName.indexOf('/') > 0) {
                const numFolders = fullName.split("/").length;
                if (numFolders > 0) {
                    parentSuite = fullName.split("/")[0];
                    if (numFolders > 1)
                        suite = fullName.split("/")[1];
                    if (numFolders > 2)
                        subSuites = fullName.split("/").slice(2);
                }
            } else {
                parentSuite = fullName;
            }
        }


        if (parentSuite !== undefined) {
            parentSuite = parentSuite.charAt(0).toUpperCase() + parentSuite.slice(1);
            allure_test.addLabel(LabelName.PARENT_SUITE, parentSuite);
            allure_test.addLabel(LabelName.FEATURE, parentSuite);
        }
        if (suite !== undefined) {
            suite = suite.charAt(0).toUpperCase() + suite.slice(1);
            allure_test.addLabel(LabelName.SUITE, suite);
        }

        if (subSuites !== undefined) {
            if (subSuites.length > 0) {
                let captalizedSubSuites = [];

                for (var i = 0; i < subSuites.length; i++) {
                    captalizedSubSuites.push(subSuites[i].charAt(0).toUpperCase() + subSuites[i].slice(1))
                }
                allure_test.addLabel(LabelName.SUB_SUITE, captalizedSubSuites.join(" > "));
            }
        }


        let path;
        if (args.item.request.url.path !== undefined) {
            if (args.item.request.url.path.length > 0) {
                path = args.item.request.url.path.join('/');
            }
        }

        if (path !== undefined)
            allure_test.addLabel(LabelName.STORY, path);

        this.runningItems.push({
            name: fullName,
            allure_test: allure_test,
            pm_item: pm_item
        })
    }

    getFullName(item, separator) {
        if (_.isEmpty(item) || !_.isFunction(item.parent) || !_.isFunction(item.forEachParent)) { return; }
        var chain = [];
        item.forEachParent(function (parent) { chain.unshift(parent.name || parent.id); });
        item.parent() && chain.push(item.name || item.id); // Add the current item only if it is not the collection
        return chain.join(_.isString(separator) ? separator : '/');
    }

    attachConsoleLogs(rItem) {
        if (rItem.pm_item.console_logs.length > 0) {
            const buf = Buffer.from(rItem.pm_item.console_logs.join('\n'), "utf8");
            const file = this.allure_runtime.writeAttachment(buf, "text/plain");
            rItem.allure_test.addAttachment("console_logs", "text/plain", file);
        }
    }

    attachPrerequest(rItem) {
        if (rItem.pm_item.prerequest !== undefined) {
            const buf = Buffer.from(rItem.pm_item.prerequest, "utf8");
            const file = this.allure_runtime.writeAttachment(buf, "application/json");
            rItem.allure_test.addAttachment("pre_request", "application/json", file);
        }
    }

    attachTestScript(rItem) {
        if (rItem.pm_item.testscript !== undefined) {
            const buf = Buffer.from(rItem.pm_item.testscript, "utf8");
            const file = this.allure_runtime.writeAttachment(buf, "application/json");
            rItem.allure_test.addAttachment("test_scrpt", "application/json", file);
        }
    }

    get currentExecutable() {
        const executable = this.currentStep || this.currentTest;
        if (executable === null) {
            console.warn("No executable, ignoring");
            return null;
        }
        return executable;
    }

    setDescription(exec, description) {
        if (description !== undefined) {
            exec.description = description;
        }
    }

    setDescriptionHtml(exec, html) {
        if (html !== undefined) {
            exec.descriptionHtml = html;
        }
    }

    passTestCase(allure_test) {
        this.endTest(allure_test, Status.PASSED);
    }

    failTestCase(allure_test, error) {
        const latestStatus = allure_test.status;
        // if test already has a failed state, we should not overwrite it
        if (latestStatus === Status.FAILED || latestStatus === Status.BROKEN) {
            return;
        }
        const status = error.name === "AssertionError" ? Status.FAILED : Status.BROKEN;
        this.endTest(allure_test, status, { message: error.message, trace: error.stack });
    }

    async item(err, args) {
        const rItem = this.runningItems[this.runningItems.length - 1];
        const currentExec = this.currentExecutable;
        this.runningItems.pop();

        if (rItem.pm_item.prerequest !== '')
            this.attachPrerequest(rItem);
        if (rItem.pm_item.testscript !== '')
            this.attachTestScript(rItem);
        if (rItem.pm_item.console_logs.length > 0)
            this.attachConsoleLogs(rItem);
        if (rItem.pm_item.failedAssertions.length > 0 && this.onAssertFailed)
            await this.onAssertFailed(this, rItem);

        const requestDataURL = rItem.pm_item.request_data.method + " - " + rItem.pm_item.request_data.url;
        let bodyModeProp = '';
        let bodyModePropObj;

        if (rItem.pm_item.request_data.body !== undefined) {
            bodyModeProp = rItem.pm_item.request_data.body.mode;
        }
        if (bodyModeProp === "raw") {
            bodyModePropObj = rItem.pm_item.request_data.body[bodyModeProp];
        } else {
            bodyModePropObj = ""
        }

        const authHeader = rItem.pm_item.request_data.headers.members.find(x => x.key == "Authorization");
        let parsedToken = null;

        if (authHeader && authHeader.value.startsWith("Bearer "))
            parsedToken = this.parseJwt(authHeader.value.substring(7));

        const reqTableStr = ` <table> <tr> <th style="border: 1px solid #dddddd;text-align: left;padding: 8px;color:Orange;"> ${bodyModeProp} </th> <td style="border: 1px solid #dddddd;text-align: left;padding: 8px;"> <pre style="color:Orange"> <b> ${bodyModePropObj} </b> </pre> </td> </tr>  </table>`;
        const tokenUserStr = ` <h4 style="color:DodgerBlue;"><b><i>User:</i></b></h4> <p style="color:DodgerBlue"> <b> ${parsedToken?.sub ?? "<unknown>"} </b> </p>`;
        const reqTokenStr = ` <h4 style="color:DodgerBlue;"><b><i>Token:</i></b></h4> <p style="color:DodgerBlue"> <b> ${authHeader?.value ?? "<none>"} </b> </p>`;

        const responseCodeStatus = rItem.pm_item.response_data.code + " - " + rItem.pm_item.response_data.status;

        var testDescription;
        if (args.item.request.description !== undefined) {
            testDescription = args.item.request.description.content;
            testDescription = testDescription.replace(/[*]/g, "");
            testDescription = testDescription.replace(/\n/g, "<br>")
        } else {
            testDescription = '';
        }

        this.setDescriptionHtml(currentExec, `<p style="color:MediumPurple;"> <b> ${testDescription} </b> </p> <h4 style="color:DodgerBlue;"><b><i>Request:</i></b></h4> <p style="color:DodgerBlue"> <b> ${requestDataURL} </b> ${tokenUserStr} ${reqTokenStr} </p> ${reqTableStr} </p> <h4 style="color:DodgerBlue;"> <b> <i> Response: </i> </b> </h4> <p style="color:DodgerBlue"> <b> ${responseCodeStatus} </b> </p> <p > <pre style="color:Orange;"> <b> ${rItem.pm_item.response_data.body} </b> </pre> </p>`);
        if (rItem.pm_item.failedAssertions.length > 0) {
            const msg = this.escape(rItem.pm_item.failedAssertions.join(", "));
            const details = this.escape(`Response code: ${rItem.pm_item.response_data.code}, status: ${rItem.pm_item.response_data.status}`);


            this.failTestCase(rItem.allure_test, {
                name: "AssertionError",
                message: msg,
                trace: details,
            });
        } else {
            this.passTestCase(rItem.allure_test);
        }
    }

    pushStep(step) {
        if (!Array.isArray(this.runningItems[this.runningItems.length - 1].steps)) this.runningItems[this.runningItems.length - 1].steps = [];
        this.runningItems[this.runningItems.length - 1].steps.push(step);
    }
    popStep() {
        return this.runningItems[this.runningItems.length - 1].steps.pop();
    }


    endTest(allure_test, status, details) {
        if (details) {
            allure_test.statusDetails = details;
        }
        allure_test.status = status;
        allure_test.stage = Stage.FINISHED;
        allure_test.endTest();
    }

    itemName(item, cursor) {
        const parentName = item.parent && item.parent() && item.parent().name ? item.parent().name : "";
        const folderOrEmpty = (!parentName || parentName === this.options.collection.name) ? "" : parentName + "/";
        const iteration = cursor && cursor.cycles > 1 ? "/" + cursor.iteration : "";
        return this.escape(folderOrEmpty + item.name + iteration);
    }

    escape(string) {
        return string
            .replace('\n', '')
            .replace('\r', '')
            .replace('\"', '"');
    }
}

module.exports = AllureReporter;
