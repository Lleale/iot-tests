import net from 'net';
import ZWaveDevice, { Property } from './device.js';
import ICtlInterface from './interfaces/ctl_interface.js';
import Utils from './utils.js';

export default class ZWaveController {
    mac: string;
    serial: string;
    vendor: string = "Eltex";
    version: string;
    model: string;
    homeId: string = "00FF00FF";
    zWaveVersion: string = "500";

    _interfaces: ICtlInterface[] = [];

    devices: ZWaveDevice[] = [];


    fillFromJSON(json: any) {
        for (var propName in json) {
            switch (propName) {
                case 'devices':
                    break;
                default:
                    this[propName] = json[propName]
            }
        }
    }
    
    toJSON(): any {
        return { ...Utils.hidePrivate(this), interfaces: this._interfaces.map(x => `${x.getType()}://${x.getHost()}:${x.getPort()}`) };
    }

    addInterface(proto: ICtlInterface): void {
        proto.initialize(this);
        this._interfaces.push(proto);
    }

    removeInterface(proto: ICtlInterface): void {
        if(proto.isConnected())
            proto.disconnect();
        this._interfaces = this._interfaces.filter(x => x != proto);
    }

    addDevice(device: ZWaveDevice): void {
        if (this.devices.some(x => x.nodeId == device.nodeId))
            throw Error('device with the same nodeId is already added');

        if (!globalThis.config.quiet)
            console.log('[CTL] Adding new device');

        if (device.nodeId < 6) {
            if (this.devices.length == 0)
                device.nodeId = 6;
            else {
                let maxNodeId = Math.max(...this.devices.map(x => x.nodeId));
                device.nodeId = maxNodeId + 1;
            }
        }

        device.on('reportGuardMode', this.onGuardReport.bind(this));
        device.on('reportKeepAlive', this.onKeepAliveReport.bind(this));
        device.on('reportPropChange', this.onPropReport.bind(this));
        device.on('reportDeviceState', this.onDeviceStateReport.bind(this));
        device.onDeviceAdded();
        this.devices.push(device);

        for (let ctl of this._interfaces)
            ctl.onDeviceAdded(device);
    }

    removeDevice(device: ZWaveDevice): void {
        if (!this.devices.some(x => x == device))
            throw Error('device is not added to this controller');

        device.removeAllListeners();
        this.devices = this.devices.filter(x => x != device);

        for (let ctl of this._interfaces)
            ctl.onDeviceRemoved(device);
    }

    onGuardReport(device: ZWaveDevice): void {
        for (let ctl of this._interfaces)
            ctl.reportDeviceGuardState(device);
    }

    onKeepAliveReport(device: ZWaveDevice): void {
        for (let ctl of this._interfaces)
            ctl.reportKeepAlive(device);
    }

    onDeviceStateReport(device: ZWaveDevice): void {
        for (let ctl of this._interfaces)
            ctl.reportDeviceState(device);
    }

    onPropReport(device: ZWaveDevice, prop: Property): void {
        for (let ctl of this._interfaces)
            ctl.reportDevicePropChange(device, prop);
    }

}