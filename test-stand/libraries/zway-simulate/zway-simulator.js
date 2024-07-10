var WebSocket = require('ws');

var config = {
    cstart: 0000,
    ccount: 10,

    UUID_pattern: "3ee8500a-40e3-419e-af70-77678b92",
    token_pattern: "3eba2821-39ad-448d-9a2a-c6b1dd88",
    MAC_pattern: "A8:BB:CC:DD:",

    connect_IP: "ws://192.168.2.179:8070",

    quiet: false
}

var shouldStop = false;

var status_total = 0;
var sent_total = 0;
var sockets = new Array();

// Home Mode
function getHomeMode(socket) {
    return socket.homeMode;
};

function setHomeMode(socket, mode) {
    socket.homeMode = mode;
    if (!config.quiet)
        console.log('[' + socket.ci + '] set homeMode ' + mode);
};

var rules = [];

var steps = [
             {first:5,steps:30,device_idx:0,element_idx:1,type:'invert',val_on:'on',val_off:'off',comment:'doorsensor1'},
//             {first:10,steps:30,device_idx:0,element_idx:1,type:'invert',val_on:'on',val_off:'off',comment:'doorsensor1'},
             
//             {first:6,steps:30,device_idx:6,element_idx:5,type:'count',val:1,comment:'smartplug2'},
//             {first:7,steps:30,device_idx:8,element_idx:5,type:'count',val:1,comment:'smartplug3'},
             
//             {first:8,steps:30,device_idx:2,element_idx:1,type:'off',val_on:'on',val_off:'off',comment:'floodsensor1'},
];

function sendObjToSock(sock, obj, command) {
    try {
        command = typeof (command) == 'undefined' ? 'message' : command;

        var data = {
            identifier: "{\"channel\":\"ZwayChannel\",\"uuid\":\"" + sock.UUID + "\"}",
            command: command,
            data: JSON.stringify(obj) // imp: data - is a json-strig, not object
        }, message = JSON.stringify(data);

        if(!sock.opened || shouldStop)
            return;

        if (sock != null) {
            sock.send(message);
            sock.msg_sent++;
        } else {
            console.log('[' + sock.ci + "] No WS-connection for sending message: " + message);
        }
    }
    catch (ex) {
        if (!shouldStop)
            console.log('[' + sock.ci + "] Failed to send message: " + ex);

    }
};

function startConnection(UUID, token, MAC, ci) {

    var socket = new WebSocket(config.connect_IP + "/?uuid=" + UUID + "&token=" + token + "&source=controller");
    sockets[ci] = socket;
    socket.ci = ci;

    socket.devices = [
        { //doorsensor1

            id: "ZWAVE_ELTEX_1",
            source: "z-wave",
            manufacturerId: 316,
            productTypeId: 2,
            productId: 2,
            productName: "11",
            interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_1-0-129",
                    deviceType: "sensorMultilevel",
                    probeType: "battery",
                    level: 100,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_1-0-32-5",
                    deviceType: "sensorBinary",
                    probeType: "door",
                    level: "off",
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_1-0-32-7",
                    deviceType: "sensorBinary",
                    probeType: "tamper",
                    level: "off",
                    updateTime: 1496221456
                }
            ]
        },
        { //motionsensor1
            id: "ZWAVE_ELTEX_2",
            source: "z-wave",
            manufacturerId: 316,
            productTypeId: 2,
            productId: 1,
            productName: "22",
            interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_2-0-127",
                    deviceType: "sensorMultilevel",
                    probeType: "battery",
                    level: 100,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_2-0-4-5",
                    deviceType: "sensorBinary",
                    probeType: "motion",
                    level: "off",
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_2-0-4-7",
                    deviceType: "sensorBinary",
                    probeType: "tamper",
                    level: "off",
                    updateTime: 1496221456
                }
            ]
        },
        { //floodsensor1
            id: "ZWAVE_ELTEX_3",
            source: "z-wave",
            manufacturerId: 316,
            productTypeId: 2817,
            productId: 2,
            productName: "33",
            interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_3-0-128",
                    deviceType: "sensorMultilevel",
                    probeType: "battery",
                    level: 100,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_3-0-8-5",
                    deviceType: "sensorBinary",
                    probeType: "flood",
                    level: "off",
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_3-0-8-7",
                    deviceType: "sensorBinary",
                    probeType: "tamper",
                    level: "off",
                    updateTime: 1496221456
                }
            ]
        },
        { //smokesensor1
            id: "ZWAVE_ELTEX_4",
            source: "z-wave",
            manufacturerId: 316,
            productTypeId: 3074,
            productId: 2,
            productName: "",
            interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_4-0-126",
                    deviceType: "sensorMultilevel",
                    probeType: "battery",
                    level: 100,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_4-0-48-25",
                    deviceType: "sensorBinary",
                    probeType: "smoke",
                    level: "off",
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_4-0-48-27",
                    deviceType: "sensorBinary",
                    probeType: "tamper",
                    level: "off",
                    updateTime: 1496221456
                }
            ]
        },
        { //doorsensor2
            id: "ZWAVE_ELTEX_5",
            source: "z-wave",
            manufacturerId: 316,
            productTypeId: 1794,
            productId: 2,
            productName: "",
            interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_5-0-125",
                    deviceType: "sensorMultilevel",
                    probeType: "battery",
                    level: 100,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_5-0-48-5",
                    deviceType: "sensorBinary",
                    probeType: "door",
                    level: "off",
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_5-0-48-7",
                    deviceType: "sensorBinary",
                    probeType: "tamper",
                    level: "off",
                    updateTime: 1496221456
                }
            ]
        },
        { //motionsensor2
            id: "ZWAVE_ELTEX_6",
            source: "z-wave",
            manufacturerId: 316,
            productTypeId: 2049,
            productId: 1,
            productName: "",
            interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_6-0-127",
                    deviceType: "sensorMultilevel",
                    probeType: "battery",
                    level: 100,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_6-0-48-15",
                    deviceType: "sensorBinary",
                    probeType: "motion",
                    level: "off",
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_6-0-48-17",
                    deviceType: "sensorBinary",
                    probeType: "tamper",
                    level: "off",
                    updateTime: 1496221456
                }
            ]
        },
        { //smartplug2
            id: "ZWAVE_ELTEX_7",
            source: "z-wave",
            manufacturerId: 316,
            productTypeId: 1538,
            productId: 4097,
            productName: "q-q",
            interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_7-0-49-1",
                    deviceType: "switchBinary",
                    probeType: "",
                    level: "off",
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_7-0-49-2",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_voltage",
                    level: 0,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_7-0-49-3",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_watt",
                    level: 0,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_7-0-49-4",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_ampere",
                    level: 0,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_7-0-49-5",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_power_factor",
                    level: 0,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_7-0-49-6",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_kilowatt_per_hour",
                    level: 0,
                    updateTime: 1496221456
                }
            ]
        },
        { //smaptlamp2
            id: "ZWAVE_ELTEX_8",
            source: "z-wave", manufacturerId: 520, productTypeId: 282, productId: 4, productName: "qq", interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_8-0-38",
                    deviceType: "switchMultilevel",
                    probeType: "multilevel",
                    level: 0,
                    updateTime: 1496221456,
                    min: 0,
                    max: 99
                },
                {
                    id: "ZWAVE_ELTEX_8-0-51-rgb",
                    deviceType: "switchRGBW",
                    probeType: "switchColor_rgb",
                    level: "on",
                    updateTime: 1496221456,
                    max: 255,
                    color: { r: 255, g: 0, b: 0 }
                },
                {
                    id: "ZWAVE_ELTEX_8-0-51-0",
                    deviceType: "switchMultilevel",
                    probeType: "switchColor_soft_white",
                    level: 99,
                    updateTime: 1496221456,
                    min: 0,
                    max: 99
                },
                {
                    id: "ZWAVE_ELTEX_8-0-51-1",
                    deviceType: "switchMultilevel",
                    probeType: "switchColor_cold_white",
                    level: 0,
                    updateTime: 1496221456,
                    min: 0,
                    max: 99
                }
            ]
        },
        { //smartplug3
            id: "ZWAVE_ELTEX_9",
            source: "z-wave",
            manufacturerId: 316,
            productTypeId: 1538,
            productId: 4097,
            productName: "q-q",
            interview: 100,
            elements: [
                {
                    id: "ZWAVE_ELTEX_9-0-49-1",
                    deviceType: "switchBinary",
                    probeType: "",
                    level: "off",
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_9-0-49-2",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_voltage",
                    level: 0,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_9-0-49-3",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_watt",
                    level: 0,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_9-0-49-4",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_ampere",
                    level: 0,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_9-0-49-5",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_power_factor",
                    level: 0,
                    updateTime: 1496221456
                },
                {
                    id: "ZWAVE_ELTEX_9-0-49-6",
                    deviceType: "sensorMultilevel",
                    probeType: "meterElectric_kilowatt_per_hour",
                    level: 0,
                    updateTime: 1496221456
                }
            ]
        }
    ];



    // vars
    socket.step = 0;
    socket.homeMode = "away";

    socket.removing_dev = "0";
    socket.max_dev_cnt = 9;
    socket.dev_cnt = 9; //start with full list of devices
    socket.stepping = 0;

    socket.MAC = MAC;
    socket.UUID = UUID;
    socket.token = token;
    socket.sent = 0;
    socket.opened = 0;

    if (!config.quiet)
        console.log('[' + socket.ci + '] Starting client: u=' + socket.UUID + ' t=' + socket.token + ' m=' + socket.MAC);

    socket.onclose = function (event) {
        if (event.wasClean) {
            if (!config.quiet)
                console.log('[' + this.ci + '] connection closed clearly: ' + event.code + ', reason: ' + event.reason);
        } else {
            console.log('[' + this.ci + '] Connection lost: ' + event.code + ', reason: ' + event.reason);
        }
        if (this.opened == 1) status_total--;
        this.opened = 0;

        if (!shouldStop) {
            console.log('[' + this.ci + '] Restarting client: u=' + this.UUID + ' t=' + this.token + ' m=' + this.MAC);
            startConnection(this.UUID, this.token, this.MAC, this.ci);
        }
    };

    socket.onerror = function (error) {
        console.log('[' + this.ci + '] error  ' + error.message);

    };


    socket.onopen = function () {
        this.opened = 1;
        if (!config.quiet)
            console.log('[' + this.ci + '] Socket opened');
        status_total++;
        this.step = 0;
        this.homeMode = "away";

        this.ping_count = 0;
        this.ping_last = parseInt(new Date().getTime());
        this.ping_first = this.ping_last;
        this.ping_time = 0;
        this.ping_min = 9999;
        this.ping_max = 0;
        this.msg_recv = 0;
        this.msg_sent = 0;

        // try to get token
        // if not user then add user
        // try to get token

        // try to get house
        // try to get controller, check mac
        // if missed then add controller to house
        // get/check device status

    };

    socket.onmessage = function (event) {

        obj = JSON.parse(event.data),
            msg = obj.message;
        ctime = parseInt(new Date().getTime());
        this.msg_recv++;
        switch (obj.type) {
            case 'ping':
                // reset time counter. if timer out - reset connection
                this.send(JSON.stringify({ type: "pong" }));
                this.ping_count++;
                ping_time = ctime - this.ping_last;
                this.ping_last = ctime;
                if ((this.ping_time >= ping_time * 21 / 20) || (this.ping_time <= ping_time * 19 / 20)) {
                    this.ping_time = ping_time;
                }
                if (this.ping_count % 10 == 0) {
                }
                if (this.ping_max < ping_time) {
                    this.ping_max = ping_time;
                }
                if (this.ping_min > ping_time) {
                    this.ping_min = ping_time;
                }

                break;
            case 'welcome':
                this.step++;
                break;
            case 'confirm_subscription':
                this.step++;
                break;
            default:

                switch (msg.action) {
                    case "getUidRequest":
                        break;
                    case "getVersionRequest":
                        break;
                    case "getHomeModeRequest":
                        break;
                    // Получение информации о контроллере
                    case "getHomeInfoRequest":
                        sendObjToSock(this, {
                            action: "getHomeInfoReply",
                            data: {
                                mac: this.MAC,
                                homeMode: getHomeMode(this),
                                vendor: "Eltex Ltd",
                                swVersion: "1v1",
                                swCommit: "1.0",
                                swDate: "23-05-2017",
                                osVersion: "1v1",
                                hwVersion: "1v1",
                                zWaveSubVersion: "500",

                            }
                        });
                        break;

                    case "setHomeMode":
                        setHomeMode(this, msg.data);
                        break;
                    case "deviceAction":
                        for (i = 0; i < this.dev_cnt; i++) {
                            for (vdev = 0; vdev < this.devices[i].elements.length; vdev++) {
                                if (msg.id == this.devices[i].elements[vdev].id) {
                                    switch (msg.command) {
                                        case "off":
                                            this.devices[i].elements[vdev].level = "off";
                                            break;
                                        case "on":
                                            this.devices[i].elements[vdev].level = "on";
                                            break;
                                        case "exact":
                                            this.devices[i].elements[vdev].level = msg.args;
                                            break;
                                    }
                                    sendObjToSock(this, {
                                        action: "deviceUpdate",
                                        data: this.devices[i]
                                    });		 // send deviceUpdate

                                    break;
                                }
                            }
                        }
                        if (this.step == 3) this.step = 29;
                        break;
                    case "getDevicesRequest":
                        var devlist = [];
                        for (i = 0; i < this.dev_cnt; i++) {
                            devlist[i] = this.devices[i];
                        }

                        sendObjToSock(this, {
                            action: "getDevicesReply",
                            data: devlist
                        });
                        if (this.step == 3) this.step = 29;
                        break;
                    case "getDeviceRequest":
                        for (i = 0; i < this.dev_cnt; i++) {
                            if (msg.id == this.devices[i].id) {
                                sendObjToSock(this, {
                                    action: "getDeviceReply",
                                    data: this.devices[i]
                                });
                            }
                        }
                        if (this.step == 3) this.step = 29;
                        break;
                    case "deviceAdd":
                        if (!config.quiet)
                            console.log(msg.action);
                        this.step = 11;
                        break;
                    case "stopDeviceAdd":
                        if (!config.quiet)
                            console.log(msg.action);
                        sendObjToSock(this, {
                            action: "deviceAddUpdate",
                            data: {
                                "status": "failed",
                                "id": "null",
                                "error": "ADD_DEVICE_UNEXPECTED_FAILURE",
                                "message": "stopped"
                            }
                        });

                        this.step = 29;
                        break;
                    case "deviceRemove":
                        if (!config.quiet)
                            console.log(msg.action);
                        if (this.dev_cnt) {
                            removing_dev = msg.id;
                            this.step = 21;
                        } else {
                            sendObjToSock(this, {
                                action: "deviceRemoveUpdate",
                                data: {
                                    "status": "failed",
                                    "id": removing_dev,
                                    "error": "REMOVE_DEVICE_UNEXPECTED_FAILURE",
                                    "message": "Nothing to remove"
                                }
                            });
                        }
                        break;
                    case "stopDeviceRemove":
                        if (!config.quiet)
                            console.log(msg.action);
                        sendObjToSock(this, {
                            action: "deviceRemoveUpdate",
                            data: {
                                "status": "failed",
                                "id": msg.id,
                                "error": "REMOVE_DEVICE_UNEXPECTED_FAILURE",
                                "message": "stopped"
                            }
                        });

                        this.step = 29;
                        break;
                    case "stopDeviceAddRemove":
                        if (!config.quiet)
                            console.log(msg.action);
                        sendObjToSock(this, {
                            action: "deviceAddUpdate",
                            data: {
                                "status": "failed",
                                "id": "null",
                                "error": "ADD_DEVICE_UNEXPECTED_FAILURE",
                                "message": "stopped"
                            }
                        });
                        sendObjToSock(this, {
                            action: "deviceRemoveUpdate",
                            data: {
                                "status": "failed",
                                "id": msg.id,
                                "error": "REMOVE_DEVICE_UNEXPECTED_FAILURE",
                                "message": "stopped"
                            }
                        });

                        this.step = 29;
                        break;
                    case "setRules":
                        if (!config.quiet)
                            console.log(msg.action);
                        rules = msg.data;
                        sendObjToSock(this, {
                            action: "setRulesReply",
                            data: { synced: true }
                        });
                        break;
                    case "runRule":
                        if (!config.quiet)
                            console.log(msg.action);
                        sendObjToSock(this, {
                            action: "ruleReply",
                            data: { id: msg.id, done: false, errors: [] }
                        });
                        break;
                    case "getRules":
                        if (!config.quiet)
                            console.log(msg.action);
                        sendObjToSock(this, {
                            action: "getRulesReply",
                            data: rules
                        });
                        break;
                    case "executeShell":
                        if (!config.quiet)
                            console.log(msg.action);
                        break;
                    case "executeJS":
                        if (!config.quiet)
                            console.log(msg.action);
                        break;
                    case "cameraEvent":
                        if (!config.quiet)
                            console.log(msg.action);
                        break;
                    default:
                        console.log(msg.action + " - unknown action!");

                        sendObjToSock(this, {
                            action: "commandNotFound",
                            data: { "status": "failed", "id": null, "message": "command not found" }
                        });
                        break;
                }
                // default type
                break;
        }

        if (this.step == 1) { // first connect
            this.send(JSON.stringify({
                "identifier": "{\"channel\":\"ZwayChannel\",\"uuid\":\"" + this.UUID + "\"}",
                "command": "subscribe"
            }));
            this.step++;
        } else if (this.step == 3) {
            this.step = 29; // first connect
        } else if (this.step == 11) { // device Add cycle  started
            sendObjToSock(this, {
                action: "deviceAddUpdate",
                data: { "status": "started", "id": "null" }
            });
            this.step++;
        } else if (this.step == 12) { // device Add cycle  userInteractionRequired
            sendObjToSock(this, {
                action: "deviceAddUpdate",
                data: { "status": "userInteractionRequired", "id": "null" }
            });

            this.step++;
        } else if (+this.step == 13) { // device Add cycle:  success
            if (this.dev_cnt >= this.max_dev_cnt) {  // max dev cnt reached
                sendObjToSock(this, {
                    action: "deviceAddUpdate",
                    data: {
                        "status": "failed",
                        "id": "null",
                        "error": "ADD_DEVICE_UNEXPECTED_FAILURE",
                        "message": "Limited to 8 devices"
                    }
                });
            } else {
                sendObjToSock(this, {
                    action: "deviceAddUpdate",
                    data: { "status": "success", "id": this.devices[this.dev_cnt].id }
                });
                this.dev_cnt++;
            }
            this.step = 29; // connected
        } else if (+this.step == 21) { // device Remove cycle:  started
            sendObjToSock(this, {
                action: "deviceRemoveUpdate",
                data: { "status": "started", "id": removing_dev }
            });
            this.step++;
        } else if (+this.step == 22) { // device Remove cycle:  userInteractionRequired
            sendObjToSock(this, {
                action: "deviceRemoveUpdate",
                data: { "status": "userInteractionRequired", "id": removing_dev }
            });
            this.step++;
        } else if (+this.step == 23) { // device Remove cycle:  success
            sendObjToSock(this, {
                action: "deviceRemoveUpdate",
                data: {
                    "status": "failed",
                    "id": removing_dev,
                    "error": "REMOVE_DEVICE_UNEXPECTED_FAILURE",
                    "message": "Only last removed"
                }
            });
            this.step = 29; // connected
        } else if (+this.step == 29) {
            this.step++;
        } else if (+this.step >= 30) {
            if (this.step - 30 < this.dev_cnt) {
                var i = this.step - 30;
                sent_total++;
                this.sent++;
            }
            this.step++;
            if (+this.step > 40) {
                this.step = 29;		// return to begin
            }
            this.stepping++; 	// inc this.stepping
            // check steps for sensors
            for (sens = 0; sens < steps.length; sens++) {
                if ((this.stepping >= steps[sens].first) &&
                    (((this.stepping - steps[sens].first) % steps[sens].steps) == 0)
                ) {
                    if (steps[sens].type == 'invert') {
                        if (this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level == steps[sens].val_on)
                            this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level = steps[sens].val_off;
                        else
                            this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level = steps[sens].val_on;
                        if (this.ci == 0 && !quiet) console.log('[' + this.ci + '] invert:  ' + steps[sens].comment + ", id" + this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].id);
                    } else if (steps[sens].type == 'on') {
                        this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level = steps[sens].val_on;
                        if (this.ci == 0 && !quiet) console.log('[' + this.ci + '] set on:  ' + steps[sens].comment + ", id" + this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].id);
                    } else if (steps[sens].type == 'off') {
                        this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level = steps[sens].val_off;
                        if (this.ci == 0 && !quiet) console.log('[' + this.ci + '] set off: ' + steps[sens].comment + ", id" + this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].id);
                    } else if (steps[sens].type == 'count') {
                        var element = this.devices[steps[sens].device_idx].elements[steps[sens].element_idx];
                        if (element != null) {
                            this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level += steps[sens].val;
                            if (this.ci == 0 && !quiet) console.log('[' + this.ci + '] increment: ' + steps[sens].comment + ", id" + this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].id);

                        }
                    } else if (steps[sens].type == 'dec') {
                        this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level -= steps[sens].val;
                        if (this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level < 0) {
                            this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].level = steps[sens].val_start;
                        }
                        if (this.ci == 0 && !quiet) console.log('[' + this.ci + '] decrement: ' + steps[sens].comment + ", id" + this.devices[steps[sens].device_idx].elements[steps[sens].element_idx].id);
                    }
                    sendObjToSock(this, {
                        action: "deviceUpdate",
                        data: this.devices[steps[sens].device_idx]
                    });		 // send deviceUpdate
                    sent_total++;
                    this.sent++;
                }
            }
        }

    };

};

async function startAllConnections() {
    var cs, ss, css;
    var zeros = "000000";

    for (ci = 0; ci < config.ccount; ci++) {
        cs = config.cstart + ci; // cs - solid index, ci - iterator index
        css = String(cs);
        var len = css.length;
        ss = zeros.substring(0, 4 - len) + css;
        var UUID = config.UUID_pattern + ss;
        var token = config.token_pattern + ss;
        var MAC = config.MAC_pattern + ss.substring(0, 2) + ":" + ss.substring(2, 4);

        startConnection(UUID, token, MAC, ci);

    } // end for(ci) - iterator index
}

function stopAllConnections() {
    shouldStop = true;
    for (var sock of sockets) {
        sock.close();
    }
}

/*
 * Based on
 * https://stackoverflow.com/a/46962952/7665043
 */
function isScript() {
    return require.main && require.main.filename === /\((.*):\d+:\d+\)$/.exec((new Error()).stack.split('\n')[2])[1]
}

if (isScript()) {
    (async () => await startAllConnections())();
}

module.exports = {
    startAllConnections,
    stopAllConnections,
    config
}
