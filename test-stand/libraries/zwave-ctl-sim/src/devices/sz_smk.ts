import ZWaveDevice, { ProbeType, Property, SecurityType } from '../device.js';

export default class SZ_WLK extends ZWaveDevice {
    security: SecurityType = SecurityType.S0
    properties: Property[] = [
        new Property({
            endpoint: "0",
            deviceType: "sensorBinary",
            model: ProbeType.Tamper,
            Value: "off"
        }) ,
        new Property({
            endpoint: "0",
            deviceType: "sensorBinary",
            model: ProbeType.Smoke,
            Value: "off"
        })
        
    ];
    protected guardMode: number = -1;

    manufacturerId: number = 923;
    productId: number = 11;
    productName: string = "unknown";
    productTypeId: number = 4;
}
