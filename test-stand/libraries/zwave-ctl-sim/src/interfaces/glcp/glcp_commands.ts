import GlcpDeviceMessages from "./glcp_device_messages.js";
import GlcpCtlInterface from "./glcp_interface.js";
import GlcpUtils from "./glcp_utils.js";
import Utils from "../../utils.js";

export default class GlcpCommands {

    static cmd_whois(proto: GlcpCtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] (whois) Controller info requested");

        let iamMsg = {
            "cmd": "iam",
            "type": "zwave",
            "mac": proto.controller.mac,
            "serial": proto.controller.serial,
            "vendor": proto.controller.vendor,
            "version": proto.controller.version,
            "model": proto.controller.model,
            "homeId": proto.controller.homeId
        }

        proto.sendData(iamMsg);
    }

    static cmd_get_all_devices(proto: GlcpCtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] (get_all_devices) Devices list requested");

        for (let device of proto.controller.devices) {
            proto.sendData(GlcpDeviceMessages.getDeviceReportMessages(device));
        }

        let devMsg = {
            "cmd": "get_all_devices_ack",
            "status": "0"
        }

        proto.sendData(devMsg);
    }

    static cmd_set_guard_mode(proto: GlcpCtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] (set_guard_mode) Set guard mode for device");

        let device = proto.controller.devices.find(x => x.nodeId == msg.sid);

        if (!device) {
            console.warn(`[GLCP 3.0] Trying to set guard mode for unknown device, sid: ${msg.sid}`);
            return;
        }

        device.setGuardMode(msg.status == 1 ? 0 : 1);
    }

    static cmd_get_dead(proto: GlcpCtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] (get_dead) Dead devices list requested");
        proto.sendData({
            "cmd": "dead_devices",
            "data": JSON.stringify(proto.controller.devices.filter(x => !x.PoweredOn).map(x => x.nodeId))
        });
    }

    static cmd_ping(proto: GlcpCtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] (ping) Are we still connected?");

        let pongMsg = {
            "cmd": "pong",
            "time": Date.now().toString().slice(0, -3)
        }

        proto.sendData(pongMsg);
    }

    static cmd_remove(proto: GlcpCtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] (remove) Removing device");

        let nodeId = Number(msg.sid);
        let device = proto.controller.devices.find(x => x.nodeId == nodeId);
        let force = Number(msg.force);

        let updateMsg = {
            cmd: "message",
            sid: GlcpUtils.getSid(device),
            type: "remove_update",
            data: JSON.stringify({
                status: "0"
            })
        }
        proto.sendData(updateMsg);

        if (force) {
            Utils.syncSleep(500);
            let device = proto.controller.devices.find(x => x.nodeId == nodeId);

            if (device)
                proto.controller.removeDevice(device);
        } else {
            updateMsg.data = JSON.stringify({
                status: "1"
            });
            proto.sendData(updateMsg);
        }
    }

    static cmd_add_device(proto: GlcpCtlInterface, msg: any): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] (add_device) Adding device");

        let updateMsg = {
            cmd: "message",
            sid: "00000000000000",
            type: "add_update",
            data: JSON.stringify({
                status: "0"
            })
        }
        proto.sendData(updateMsg);

        updateMsg.data = JSON.stringify({
            status: "1"
        });
        proto.sendData(updateMsg);
    }
}
