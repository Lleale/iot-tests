import net from 'net';
import Controller from '../../controller.js';
import Device, { ProbeType, Property } from '../../device.js';
import ICtlInterface from '../ctl_interface.js';
import GlcpCommands from './glcp_commands.js';
import GlcpDeviceMessages from './glcp_device_messages.js';
import GlcpUtils from './glcp_utils.js';

export default class GlcpCtlInterface implements ICtlInterface {

    private host: string;
    private port: number;

    controller: Controller;

    socket: net.Socket;
    heartbeatLoop: NodeJS.Timeout;

    shouldReconnect: boolean = true;
    connectionStatus: string = "not_connected";

    initialize(ctl: Controller): void {
        this.controller = ctl;
    }

    getType(): string {
        return 'glcp';
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

        this.socket = new net.Socket();

        try {
            this.socket.once('error', this.onConnectionClosed.bind(this));
            this.socket.once('close', this.onConnectionClosed.bind(this));
            this.socket.on('data', this.onDataReceived.bind(this));

            this.socket.setEncoding("utf8");
            this.socket.connect(this.port, this.host, this.onConnectionOpen.bind(this));
        } catch (ex) {
            console.warn(`[GLCP 3.0] Unable to connect: ${ex}`);
        }
    }

    disconnect(): void {
        if (this.heartbeatLoop)
            clearInterval(this.heartbeatLoop);

        this.socket?.destroy();
        this.socket?.removeAllListeners();
        this.socket = null;
        this.shouldReconnect = false;
        this.connectionStatus = "not_connected";

        console.log("[GLCP 3.0] Successfully disconnected");
    }

    isConnected(): boolean {
        return this.socket && this.socket.readyState == 'open';
    }

    getHost(): string {
        return this.host;
    }

    getPort(): number {
        return this.port;
    }

    onConnectionOpen(): void {
        console.log("[GLCP 3.0] Successfully connected");
        this.heartbeatLoop = setInterval(this.controllerHeartbeat.bind(this), 30000);
        this.connectionStatus = "connected";
    }

    onConnectionClosed(err) {
        if (this.heartbeatLoop)
            clearInterval(this.heartbeatLoop);

        if (err) {
            console.warn(`[GLCP 3.0] Connection closed! Error: ${err}`)
        } else {
            console.log("[GLCP 3.0] Connection closed");
        }

        this.socket?.removeAllListeners();
        this.socket = null;
        this.shouldReconnect = true;
        this.connectionStatus = "disconnected";

        setTimeout(this.reconnect.bind(this), 5000);
    }

    onDataReceived(data) {
        if (!globalThis.config.quiet)
            console.log(`[GLCP 3.0] Got data: ${data}`);

        let parts = data.split('|');

        for (let part of parts) {
            let msg = JSON.parse(part);

            if (GlcpCommands["cmd_" + msg.cmd]) {
                GlcpCommands["cmd_" + msg.cmd](this, msg);
            } else {
                console.warn(`[GLCP 3.0] Function "cmd_${msg.cmd}" is not implemented`);
            }

        }
    }

    onDeviceRemoved(device: Device): void {
        let tamperAckMsg = {
            cmd: "remove_ack",
            model: "tamper",
            sid: GlcpUtils.getSid(device)
        }
        this.sendData(tamperAckMsg);

        let removeMsg = {
            cmd: "message",
            sid: GlcpUtils.getSid(device),
            type: "remove_update",
            data: JSON.stringify({
                status: "2"
            })
        }
        this.sendData(removeMsg);
    }

    onDeviceAdded(device: Device): void {
        this.sendData(GlcpDeviceMessages.getDeviceReportMessages(device));
    }

    sendData(msgs) {
        let msgString;

        if (msgs instanceof Array) {
            msgString = "";

            if (msgs.length == 0)
                return;

            for (let msg of msgs) {
                msgString += JSON.stringify(msg) + "|";
            }
        } else {
            msgString = JSON.stringify(msgs) + "|";
        }

        if (this.socket) {
            if (!globalThis.config.quiet)
                console.log(`[GLCP 3.0] Sending data: ${msgString}`);
            this.socket.write(msgString);
        }
        else
            console.warn("[GLCP 3.0] No connection to send messages");
    }

    controllerHeartbeat() {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] Sending heartbeat");

        for (let device of this.controller.devices) {
            if (device.PoweredOn)
                this.sendData(GlcpDeviceMessages.getDeviceHeartbeatMessages(device));
            else
                this.reportDeviceState(device);
        }
    }

    reportKeepAlive(device: Device): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] Ignoring keep alive period change");
    }

    reportDeviceState(device: Device): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] Sending device state change");


        if (device.PoweredOn) {
            this.sendData(GlcpDeviceMessages.getDeviceHeartbeatMessages(device));
            this.sendData(GlcpDeviceMessages.getReportGuardModeMessage(device));

            for (let prop of device.properties.filter(x => x.model != ProbeType.Tamper)) {
                this.sendData(GlcpDeviceMessages.getPropertyReadMessage(device, prop));
            }
        }
        else {
            let statusMsg = {
                cmd: "message",
                sid: GlcpUtils.getSid(device),
                type: "device_status",
                data: JSON.stringify({
                    status: "3",
                    error: "DEVICE_NOT_WORKING",
                    message: "The controller detected a sensor failure"
                })
            };

            this.sendData(statusMsg);
        }
    }

    reportDeviceGuardState(device: Device): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] Reporting guard status");

        this.sendData(GlcpDeviceMessages.getSetGuardModeResponseMessage(device));
        for (let prop of device.properties.filter(x => x.model != ProbeType.Tamper))
            this.sendData(GlcpDeviceMessages.getPropertyReadMessage(device, prop));
        this.sendData(GlcpDeviceMessages.getReportGuardModeMessage(device));
    }

    reportDevicePropChange(device: Device, prop: Property): void {
        if (!globalThis.config.quiet)
            console.log("[GLCP 3.0] Reporting property change");
        this.sendData(GlcpDeviceMessages.getPropertyReadMessage(device, prop));
    }
}

