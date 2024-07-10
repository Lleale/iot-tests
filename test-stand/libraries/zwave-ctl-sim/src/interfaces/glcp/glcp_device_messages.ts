import Controller from '../../controller.js';
import Device, { ProbeType, Property } from '../../device.js';
import GlcpUtils from './glcp_utils.js';

export default class GlcpDeviceMessages {

    static getDeviceReportMessages(device: Device): any[] {
        let messages = [
            this.getSecuritySchemeMessage(device),
            this.getVersionMessage(device)
        ];

        for (let prop of device.properties) {
            messages.push(this.getPropertyReadMessage(device, prop));
        }

        if (device.GuardMode >= 0) {
            messages.push(this.getAddGuardModeMessage(device));
            messages.push(this.getReportGuardModeMessage(device));
        }

        let tamperProp = device.properties.find(x => x.model == ProbeType.Tamper);

        if (device.batteryVoltage >= 0 && tamperProp) {
            messages.push(this.getPropertyHeartbeatMessage(device, tamperProp));
        }

        messages.push(this.getAddUpdateMessage(device));

        return messages;
    }

    static getDeviceHeartbeatMessages(device: Device): any[] {
        let messages: any[] = [];

        let tamperProp: Property | undefined = device.properties.find(x => x.model == ProbeType.Tamper);

        if (device.batteryVoltage >= 0 && tamperProp !== undefined) {
            messages.push(this.getPropertyHeartbeatMessage(device, tamperProp));
        }

        return messages;
    }

    static getSecuritySchemeMessage(device: Device): any {
        let secMsg = {
            "cmd": "security_scheme",
            "sid": GlcpUtils.getSid(device),
            "scheme": device.security
        }

        return secMsg;
    }

    static getAddUpdateMessage(device: Device): any {
        let addUpdateMsg = {
            "cmd": "message",
            "sid": GlcpUtils.getSid(device),
            "type": "add_update",
            "data": JSON.stringify(
                {
                    "status": "5",
                    "dsk": device.dsk
                })
        }

        return addUpdateMsg;
    }

    static getVersionMessage(device: Device): any {
        let verMsg = {
            "cmd": "set_version",
            "sid": GlcpUtils.getSid(device),
            "version": device.version
        }

        return verMsg;
    }

    static getAddGuardModeMessage(device: Device): any {
        let guardMsg = {
            "cmd": "add_guard_mode",
            "sid": GlcpUtils.getSid(device),
            "data": JSON.stringify(
                {
                    "value": device.GuardMode.toString(),
                })
        }

        return guardMsg;
    }

    static getSetGuardModeResponseMessage(device: Device): any {
        let guardMsg = {
            "cmd": "report_guard",
            "sid": GlcpUtils.getSid(device),
            "data": JSON.stringify(
                {
                    "status": device.GuardMode == 0 || device.GuardMode == 2 ? "on" : "off",
                })
        }

        return guardMsg;
    }

    static getReportGuardModeMessage(device: Device): any {
        let guardMsg = {
            "cmd": "report_guard",
            "sid": GlcpUtils.getSid(device),
            "data": JSON.stringify(
                {
                    "value": device.GuardMode.toString(),
                })
        }

        return guardMsg;
    }

    static getPropertyReadMessage(device: Device, property: Property): any {
        let propValue = null;

        switch (property.model) {
            case ProbeType.Temperature:
            case ProbeType.Humidity:
                propValue = (property.Value * 100).toString();
                break;
            default:
                propValue = property.Value.toString();
        }

        let propMsg = {
            "cmd": "read_ack",
            "model": GlcpUtils.probeMap.getName(property.model),
            "sid": GlcpUtils.getSid(device),
            "endpoint": property.endpoint,
            "data": JSON.stringify(
                {
                    [GlcpUtils.propertyValueMap.getName(property.model)]: propValue
                })
        }

        return propMsg;
    }

    static getPropertyHeartbeatMessage(device: Device, property: Property): any {
        let propMsg = {
            "cmd": "heartbeat",
            "model": GlcpUtils.probeMap.getName(property.model),
            "sid": GlcpUtils.getSid(device),
            "endpoint": property.endpoint,
            "data": JSON.stringify(
                {
                    "status": property.Value.toString(),
                    "voltage": device.batteryVoltage.toString()
                })
        }

        return propMsg;
    }
}