import Controller from '../controller.js';
import Device, { Property } from '../device.js';

export default interface ICtlInterface {

    initialize(ctl: Controller): void;
    getType(): string;

    connect(host: string, port: number): Promise<boolean>;
    disconnect(): void;
    isConnected(): boolean;
    getHost(): string;
    getPort(): number;

    onDeviceRemoved(device: Device): void;
    onDeviceAdded(device: Device): void;

    reportDeviceGuardState(device: Device): void;
    reportKeepAlive(device: Device): void;
    reportDeviceState(device: Device): void;
    reportDevicePropChange(device: Device, prop: Property): void;
}