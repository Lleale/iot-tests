import Controller from '../../controller.js';
import Device, { Property, SecurityType, ProbeType } from '../../device.js';
import O7Utils from './o7_utils.js';
export default class O7DeviceMessages {

    static getDeviceInfo(device: Device): any {
        let deviceInfo = {
            dsk: device.dsk,
            elements: [],
            id: `ZWAVE_ELTEX_${device.nodeId}`,
            interview: 100,
            manufacturerId: device.manufacturerId,
            productId: device.productId,
            productName: device.productName,
            productTypeId: device.productTypeId,
            securityCapabilities: [
                "insecure",
                "s0"
            ],
            securityScheme: device.security == SecurityType.S2 ? "s2" : "insecure",
            source: "z-wave",
            version: device.version
        }

        if (device.batteryVoltage >= 0) {
            deviceInfo.elements.push({
                deviceType: "sensorMultilevel",
                id: `ZWAVE_ELTEX_${device.nodeId}-128-0-0-0`,
                level: device.getBatteryLevel(),
                probeType: "battery",
                updateTime: Math.round(Date.now() / 1000)
            });
        }

        if (device.security == SecurityType.S2)
            deviceInfo.securityCapabilities.push("s2")

        if (device.GuardMode >= 0) {
            deviceInfo.elements.push({
                deviceType: "switchMultilevel",
                id: `ZWAVE_ELTEX_${device.nodeId}-112-0-0-0`,
                level: device.KeepAlivePeriod,
                max: 65536,
                min: 0,
                probeType: "configuration",
                updateTime: Math.round(Date.now() / 1000)
            });
            deviceInfo.elements.push({
                deviceType: "switchBinary",
                id: `ZWAVE_ELTEX_${device.nodeId}-65317-0-0-0`,
                level: device.GuardMode == 0 || device.GuardMode == 2 ? "on" : "off",
                probeType: "guard_mode",
                updateTime: Math.round(Date.now() / 1000)
            });
            deviceInfo.elements.push({
                deviceType: "sensorMultilevel",
                id: `ZWAVE_ELTEX_${device.nodeId}-94-0-0-0`,
                level: device.GuardMode,
                probeType: "guard_status",
                updateTime: Math.round(Date.now() / 1000)
            });
        }
        else if (device.batteryVoltage >= 0) {
            deviceInfo.elements.push({
                deviceType: "switchMultilevel",
                id: `ZWAVE_ELTEX_${device.nodeId}-132-0-0-0`,
                level: device.KeepAlivePeriod,
                max: 86400,
                min: 60,
                probeType: "wakeup_interval",
                updateTime: Math.round(Date.now() / 1000)
            });
        }

        for (let prop of device.properties) {
            if (!prop.updateTime)
                prop.updateTime = Math.round(Date.now() / 1000)

            let probeType = O7Utils.probeMap.getName(prop.model);

            if (probeType === undefined)
                throw Error(`Probe type "${prop.model}" is not defined`);

            deviceInfo.elements.push({
                deviceType: prop.deviceType,
                id: `ZWAVE_ELTEX_${device.nodeId}-000-${probeType}-${prop.endpoint}`,
                level: prop.Value,
                probeType: probeType,
                updateTime: prop.updateTime
            })
        }

        return deviceInfo;

    }
}