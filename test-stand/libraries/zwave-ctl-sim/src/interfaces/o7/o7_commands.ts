import O7CtlInterface from "./o7_interface.js";
import O7DeviceMessages from "./o7_device_messages.js";
import O7Utils from "./o7_utils.js";
import Utils from "../../utils.js";

export default class O7Commands {

    private static propertyNodeId: RegExp = /ZWAVE_ELTEX_(?<nodeId>\d+)-(?<propId>\d+)-(\d+)-(\d+)-(?<probeType>\d+)/
    private static nodeId: RegExp = /ZWAVE_ELTEX_(?<nodeId>\d+)/

    static type_welcome(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (welcome) Subscribing to Zway channel");

        let subMsg =
        {
            command: "subscribe",
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: proto.uuid
            })
        }

        proto.sendData(subMsg);
    }

    static type_ping(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (ping) Are we still connected?");

        let pongMsg =
        {
            type: "pong"
        }

        proto.sendData(pongMsg);
    }

    static type_confirm_subscription(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (confirm_subscription) Successfully subscribed to Zway channel");
    }

    static msg_getHomeInfoRequest(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (getHomeInfoRequest) Sending home info");

        let homeInfoMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: proto.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "getHomeInfoReply",
                data: {
                    controllerCapabilities: [
                        "s2",
                        "smartStart",
                        "systemUpgrade",
                        "zwaveOtaUpgrade",
                        "backup"
                    ],
                    homeId: proto.controller.homeId,
                    homeMode: "",
                    hwVersion: "2v1",
                    mac: proto.controller.mac,
                    model: proto.controller.model,
                    sdkSubVersion: "7.13",
                    serial: proto.controller.serial,
                    swVersion: proto.controller.version,
                    vendor: proto.controller.vendor,
                    zWaveSubVersion: proto.controller.zWaveVersion
                }
            })
        }

        proto.sendData(homeInfoMsg);
    }

    static msg_getDevicesRequest(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (getDevicesRequest) Sending device list");

        let devicesMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: proto.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "getDevicesReply",
                data: proto.controller.devices.map(x => O7DeviceMessages.getDeviceInfo(x))
            })
        }

        proto.sendData(devicesMsg);
        proto.restartControllerHeartbeat();
    }

    static msg_deviceAction(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (deviceAction) Doing something with the device");

        let propertyNodeMatch = this.propertyNodeId.exec(msg.message.id);
        if (propertyNodeMatch) {
            let nodeId = Number(propertyNodeMatch.groups["nodeId"]);
            let propId = Number(propertyNodeMatch.groups["propId"]);

            let device = proto.controller.devices.find(x => x.nodeId == nodeId);

            if (!device) {
                console.warn(`[O7] Trying to do action on non-existent device (NodeID: ${nodeId})`);
                return;
            }

            switch (propId) {
                case 132: //wakeup_interval
                case 112: //configuration
                    {
                        device.KeepAlivePeriod = Number(msg.message.args.level);
                    }
                    break;
                case 65317: //guard_mode
                    {
                        device.setGuardMode(msg.message.command == "on" ? 0 : 1);
                    }
                    break;
                case 0: //other property
                    {
                        let probeType = O7Utils.probeMap.getType(propertyNodeMatch.groups["probeType"]);
                        let prop = device.getProperty("0", probeType)

                        switch (msg.message.command) {
                            case "exact": prop.Value(msg.message.args.level); break;
                            case "on": prop.Value("on"); break;
                            case "off": prop.Value("off"); break;
                            default: console.warn(`[O7] Unknown device action command "${msg.message.command}"!`);
                        }
                    }
                    break;
            }
        }
    }

    static msg_deviceAdd(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (deviceAdd) Adding new device");

        let devicesMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: proto.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "deviceAddUpdate",
                data: {
                    id: null,
                    status: "started"
                }
            })
        }
        proto.sendData(devicesMsg);

        devicesMsg.data = JSON.stringify({
            action: "deviceAddUpdate",
            data: {
                id: null,
                status: "userInteractionRequired"
            }
        })
        proto.sendData(devicesMsg);
    }

    static msg_deviceRemove(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (deviceRemove) Removing device");

        if (msg.message.dead) {
            let nodeMatch = this.nodeId.exec(msg.message.id);
            if (nodeMatch) {
                let nodeId = Number(nodeMatch.groups["nodeId"]);
                let device = proto.controller.devices.find(x => x.nodeId == nodeId);

                if (device)
                    proto.controller.removeDevice(device);
            }
        }
        else {
            let devicesMsg =
            {
                identifier: JSON.stringify({
                    channel: "ZwayChannel",
                    uuid: proto.uuid
                }),
                command: "message",
                data: JSON.stringify({
                    action: "deviceRemoveUpdate",
                    data: {
                        id: msg.message.id,
                        status: "started"
                    }
                })
            }
            proto.sendData(devicesMsg);

            devicesMsg.data = JSON.stringify({
                action: "deviceRemoveUpdate",
                data: {
                    id: msg.message.id,
                    status: "userInteractionRequired"
                }
            })
            proto.sendData(devicesMsg);
        }
    }

    static msg_downloadFile(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (downloadFile) Ignoring firmware, sending failed status");

        let downloadedMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: proto.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "downloadFileReply",
                data: {
                    completeTime: 0,
                    faultCode: 0,
                    faultString: "Firmware has been downloaded",
                    progress: 0,
                    startTime: 0,
                    status: 0
                }
            })
        }
        proto.sendData(downloadedMsg);
	Utils.syncSleep(1000);
        function sendFailedStatus(nodeId: number = -1): void {
            let failedMsg =
            {
                identifier: JSON.stringify({
                    channel: "ZwayChannel",
                    uuid: proto.uuid
                }),
                command: "message",
                data: JSON.stringify({
                    action: "downloadFileReply",
                    data: {
                        completeTime: 0,
                        faultCode: 4,
                        faultString: "Cannot upgrade the device",
                        progress: 0,
                        startTime: 0,
                        status: 1,
                        ...(nodeId >= 6 ? { id: `ZWAVE_ELTEX_${nodeId}` } : {})
                    }
                })
            }
            proto.sendData(failedMsg);
        }

        if (msg.message.data.nodeIds.length == 0) {
            sendFailedStatus();
        }
        else {
            for (let nodeId of msg.message.data.nodeIds) {
                sendFailedStatus(Number(nodeId));
            }
        }
    }

    static msg_stopDeviceAdd(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (stopDeviceAdd) Stopping adding device");

        let failedMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: proto.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "deviceAddUpdate",
                data: {
                    error: "ADD_DEVICE_DEVICE_NOT_FOUND",
                    id: null,
                    message: "No device with such ID",
                    status: "failed",
                    type: ""
                }
            })
        }
        proto.sendData(failedMsg);
    }

    static msg_stopDeviceRemove(proto: O7CtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[O7] (stopDeviceRemove) Stopping removing device");

        let failedMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: proto.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "deviceRemoveUpdate",
                data: {
                    error: "REMOVE_DEVICE_DEVICE_NOT_FOUND",
                    id: null,
                    message: "No device with such ID",
                    status: "failed",
                    type: ""
                }
            })
        }
        proto.sendData(failedMsg);
    }
}
