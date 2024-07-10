import ZWaveDevice, { ProbeType, Property, SecurityType } from '../device.js';

export default class SZ_PIR_RevC extends ZWaveDevice {
    security: SecurityType = SecurityType.S2
    properties: Property[] = [
        new Property({
            endpoint: "0",
            deviceType: "sensorMultilevel",
            model: ProbeType.Illumination,
            Value: 100
        }),
        new Property({
            endpoint: "0",
            deviceType: "sensorBinary",
            model: ProbeType.Tamper,
            Value: "off"
        }),
        new Property({
            endpoint: "0",
            deviceType: "sensorBinary",
            model: ProbeType.Motion,
            Value: "off"
        })
        
    ];
    protected guardMode: number = 1;

    manufacturerId: number = 923;
    productId: number = 12;
    productName: string = "unknown";
    productTypeId: number = 4;
}