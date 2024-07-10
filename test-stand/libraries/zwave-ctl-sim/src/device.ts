import Emitter from 'events';
import EventEmitter from 'node:events';
import Utils from './utils.js';

export class Property extends EventEmitter {
    endpoint: string;
    deviceType: string;
    model: ProbeType;
    protected value: any;
    public get Value(): any {
        return this.value;
    }
    public set Value(value: any) {
        this.value = value;
        this.updateTime = Math.round(Date.now() / 1000);
        this.emit('valueChanged', this);
    }

    updateTime?: number;

    public constructor(init?: Partial<Property>) {
        super();
        Object.assign(this, init);
    }

    fillFromJSON(json: any) {
        for (var propName in json) {
            this[propName] = json[propName]
        }
    }

    toJSON(): any {
        return Utils.hidePrivate(this);
    }
}

export class DeviceAction {
    property: Property;
    ruleRegExp: RegExp;
    action: () => void;
}

export enum SecurityType {
    Insecure = "insecure",
    S0 = "s0",
    S2 = "s2"
}

export enum ProbeType {
    Tamper = "tamper",
    OpenClose = "openClose",
    Motion = "motion",
    GlassBreak = "glassBreak",
    Smoke = "smoke",
    WaterLeak = "waterLeak",
    CO2 = "co2",
    VOC = "voc",
    Humidity = "humidity",
    Temperature = "temperature",
    Illumination = "illumination",
}

export default class ZWaveDevice extends EventEmitter {
    dsk: string;

    nodeId: number;
    security: SecurityType = SecurityType.Insecure;
    version: string = "1.0";
    manufacturerId: number = 0;
    productId: number = 0;
    productName: string = "unknown";
    productTypeId: number = 0;

    properties: Property[] = [
        new Property({
            endpoint: "0",
            deviceType: "sensorBinary",
            model: ProbeType.Tamper,
            Value: "off"
        })];

    batteryVoltage: number = 3200;

    protected poweredOn: boolean = true;
    public get PoweredOn(): boolean {
        return this.poweredOn;
    }
    public set PoweredOn(isPowered: boolean) {
        if (!globalThis.config.quiet)
            console.log(`Setting device power: ${isPowered ? "on" : "off"}`);
        this.poweredOn = isPowered;
        this.emit('reportDeviceState', this);
        this.triggerDeviceAction(`power:${isPowered}`);
    }

    protected guardMode: number = -1;
    public get GuardMode(): number {
        return this.guardMode;
    }

    protected keepAlivePeriod: number = 15;
    public get KeepAlivePeriod(): number {
        return this.keepAlivePeriod;
    }
    public set KeepAlivePeriod(timeout: number) {
        if (!globalThis.config.quiet)
            console.log(`Setting keep alive period: ${timeout}`);
        this.keepAlivePeriod = timeout;

        if (this.PoweredOn) {
            this.emit('reportKeepAlive', this);
            this.triggerDeviceAction(`keepAlive:${timeout}`);
        }
    }

    guardInitDelay: number = 1500;
    silent: boolean = false;

    _actions: DeviceAction[] = [];

    constructor(nodeId: number = -1, dsk: string = "0000000000000000000000000000000000000000") {
        super();
        this.nodeId = nodeId;
        this.dsk = dsk;
    }

    fillFromJSON(json: any, edit: boolean = false) {
        for (var propName in json) {
            switch (propName) {
                case 'guardInitDelay':
                    this[<any>propName] = json[propName];
                    break;
                case 'batteryVoltage':
                    this[<any>propName] = json[propName];
                    if (this.PoweredOn)
                        this.emit('reportDeviceState', this);
                    break;
                case 'properties':
                    if (edit)
                        for (var oldProp of this.properties)
                            oldProp.removeAllListeners();

                    this.properties = [];

                    for (var prop of json.properties) {
                        var propObj = new Property();
                        propObj.fillFromJSON(prop)
                        this.properties.push(propObj);
                    }

                    if (edit)
                        this.onDeviceAdded();
                    break;
                default:
                    if (!edit)
                        this[<any>propName] = json[propName];
            }
        }
    }

    toJSON(): any {
        return Utils.hidePrivate(this);
    }

    onDeviceAdded(): void {
        for (let prop of this.properties) {
            prop.on('valueChanged', this.onPropertyChanged.bind(this));
        }
    }

    private onPropertyChanged(prop: Property): void {
        if (this.PoweredOn && !this.silent) {
            this.emit('reportPropChange', this, prop);
            this.triggerDeviceAction(`propChange:${prop.endpoint}:${prop.model}:${prop.Value}`);
        }
    }

    async setGuardMode(guardMode: number): Promise<void> {
        if (!this.PoweredOn || this.guardMode == 2 || this.guardMode == guardMode)
            return;

        if (!globalThis.config.quiet)
            console.log(`Setting guard mode: ${guardMode}`);

        if (this.guardMode == 1 && guardMode == 0) {
            this.guardMode = 2;
            this.emit('reportGuardMode', this);
            this.triggerDeviceAction(`guardMode:${this.guardMode}`);
        }
        
        await Utils.sleep(this.guardInitDelay);
        this.guardMode = guardMode;
        this.emit('reportGuardMode', this);
        this.triggerDeviceAction(`guardMode:${this.guardMode}`);
    }

    getBatteryLevel(): number {
        return Math.min(Math.max(Math.round((this.batteryVoltage - 2200) / 10), 0), 100);
    }

    getProperty(endpoint: string, type: ProbeType): Property | undefined {
        return this.properties.find(x => x.endpoint == endpoint && x.model == type);
    }

    triggerDeviceAction(eventType: string): void {
        for (let rule of this._actions) {
            if (rule.ruleRegExp.test(eventType))
                rule.action();
        }
        this._actions = this._actions.filter(x => !x.ruleRegExp.test(eventType));
    }
}
