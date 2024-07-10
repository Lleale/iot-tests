import net from 'net';
import Controller from '../../controller.js';
import Device, { Property } from '../../device.js';
import ICtlInterface from '../ctl_interface.js';
import WebSocket from 'ws';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import O7Commands from './o7_commands.js';
import O7DeviceMessages from './o7_device_messages.js';
import Utils from '../../utils.js';

export default class O7CtlInterface implements ICtlInterface {

    private host: string;
    private port: number;

    controller: Controller;

    uuid: string;
    token: string;

    ws: WebSocket;
    heartbeatLoop: NodeJS.Timeout;

    shouldReconnect: boolean = true;
    connectionStatus: string = "not_connected";

    initialize(ctl: Controller): void {
        this.controller = ctl;
    }

    getType(): string {
        return 'o7';
    }

    async connect(host: string, port: number): Promise<boolean> {
        this.shouldReconnect = true;
        this.host = host;
        this.port = port;

        this.reconnect();

        const connectionPromise = new Promise((resolve, reject) => {
            const loop = () => this.connectionStatus != "not_connected" ? resolve(this.connectionStatus) : setTimeout(loop)
            loop();
        });

        return (await connectionPromise) == "connected";
    }

    private reconnect(): void {
        if (!this.shouldReconnect)
            return;

        if (!this.controller)
            throw new Error("interface is not initialized. Use initialize(Controller) first");

        this.token = uuidv4();
        this.uuid = uuidv5(this.controller.serial, uuidv5.URL);

        this.ws = new WebSocket(`ws://${this.host}:${this.port}/?source=controller&token=${this.token}&uuid=${this.uuid}`);

        this.ws.once('error', this.onConnectionClosed.bind(this));
        this.ws.once('close', this.onConnectionClosed.bind(this));
        this.ws.once('open', this.onConnectionOpen.bind(this));
        this.ws.on('message', this.onDataReceived.bind(this));

    }

    disconnect(): void {
        if (this.heartbeatLoop)
            clearInterval(this.heartbeatLoop);

        this.ws?.close();
        this.ws?.removeAllListeners();
        this.ws = null;
        this.shouldReconnect = false;
        this.connectionStatus = "not_connected";

        console.log("[O7] Successfully disconnected");
    }

    isConnected(): boolean {
        return this.ws && this.ws.readyState == WebSocket.OPEN;
    }

    getHost(): string {
        return this.host;
    }

    getPort(): number {
        return this.port;
    }

    onConnectionOpen(): void {
        console.log("[O7] Successfully connected");
        this.heartbeatLoop = setInterval(this.controllerHeartbeat.bind(this), 30000);
        this.connectionStatus = "connected";
    }

    onConnectionClosed(err) {
        if (this.heartbeatLoop)
            clearInterval(this.heartbeatLoop);

        if (err) {
            console.warn(`[O7] Connection closed! Error: ${err}`)
        } else {
            console.log("[O7] Connection closed");
        }

        this.ws?.removeAllListeners();
        this.ws = null;
        this.shouldReconnect = true;
        this.connectionStatus = "disconnected";

        setTimeout(this.reconnect.bind(this), 5000);
    }

    onDataReceived(data) {
        if (!globalThis.config.quiet)
            console.log(`[O7] Got data: ${data}`);

        let msg = JSON.parse(data);

        let func = 'UNKNOWN';

        if (msg.type) {
            func = 'type_' + msg.type;
        }
        else if (msg.message && msg.message.action) {
            func = 'msg_' + msg.message.action;
        }
        else if (msg.message) {
            func = 'message';
        }

        if (O7Commands[func]) {
            O7Commands[func](this, msg);
        } else {
            console.warn(`[O7] Function "${func}" is not implemented`);
        }
    }

    onDeviceRemoved(device: Device): void {
        let devicesMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: this.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "deviceRemoveUpdate",
                data: {
                    id: `ZWAVE_ELTEX_${device.nodeId}`,
                    status: "success"
                }
            })
        }
        this.sendData(devicesMsg)
    }

    onDeviceAdded(device: Device): void {
        let devicesMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: this.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "deviceAddUpdate",
                data: {
                    id: `ZWAVE_ELTEX_${device.nodeId}`,
                    status: "success"
                }
            })
        }
        this.sendData(devicesMsg);

        (async () => {
            await Utils.sleep(1500);
            this.sendDeviceUpdate(device);
        })();
    }

    sendData(msgs) {
        if (msgs instanceof Array) {
            if (msgs.length == 0)
                return;

            for (let msg of msgs) {
                if (this.ws) {
                    let msgString = JSON.stringify(msg);
                    if (!globalThis.config.quiet)
                        console.log(`[O7] Sending data: ${msgString}`);
                    this.ws.send(msgString);
                }
                else
                    console.warn("[O7] No connection to send messages");
            }
        } else {
            if (this.ws) {
                let msgString = JSON.stringify(msgs);
                if (!globalThis.config.quiet)
                    console.log(`[O7] Sending data: ${msgString}`);
                this.ws.send(msgString);
            }
            else
                console.warn("[O7] No connection to send messages");
        }
    }

    restartControllerHeartbeat() {
        if (this.heartbeatLoop)
            clearInterval(this.heartbeatLoop);
        this.heartbeatLoop = setInterval(this.controllerHeartbeat.bind(this), 30000);
    }

    controllerHeartbeat() {
        if (!globalThis.config.quiet)
            console.log("[O7] Sending heartbeat");

        for (let device of this.controller.devices) {
            if (device.PoweredOn)
                this.sendDeviceUpdate(device);
            else
                this.sendDeviceDead(device);
        }
    }

    reportKeepAlive(device: Device): void {
        if (!globalThis.config.quiet)
            console.log("[O7] Reporting keep alive period");
        this.sendDeviceUpdate(device);
    }

    reportDeviceState(device: Device): void {
        if (!globalThis.config.quiet)
            console.log("[O7] Reporting device state");

        if (device.PoweredOn)
            this.sendDeviceUpdate(device);
        else
            this.sendDeviceDead(device);
    }

    reportDeviceGuardState(device: Device): void {
        if (!globalThis.config.quiet)
            console.log("[O7] Reporting guard status");
        this.sendDeviceUpdate(device);
    }

    reportDevicePropChange(device: Device, prop: Property): void {
        if (!globalThis.config.quiet)
            console.log("[O7] Reporting property change");
        this.sendDeviceUpdate(device);
    }

    sendDeviceUpdate(device: Device): void {
        let updateMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: this.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "deviceUpdate",
                data: O7DeviceMessages.getDeviceInfo(device)
            })
        }

        this.sendData(updateMsg);
    }

    sendDeviceDead(device: Device): void {
        let updateMsg =
        {
            identifier: JSON.stringify({
                channel: "ZwayChannel",
                uuid: this.uuid
            }),
            command: "message",
            data: JSON.stringify({
                action: "deviceAddUpdate",
                data: {
                    error: "DEVICE_NOT_WORKING",
                    id: `ZWAVE_ELTEX_${device.nodeId}`,
                    message: "The controller detected a sensor failure",
                    status: "failed",
                    type: ""
                }
            })
        }

        this.sendData(updateMsg);
    }
}

