import ZWaveDevice, { ProbeType, Property, SecurityType } from '../device.js';

export default class SZ_AIR_HTQ01 extends ZWaveDevice {
    security: SecurityType = SecurityType.S2
    properties: Property[] = [
        new Property({
            endpoint: "1",
            deviceType: "sensorMultilevel",
            model: ProbeType.Temperature,
            Value: 20
        }),
        new Property({
            endpoint: "2",
            deviceType: "sensorMultilevel",
            model: ProbeType.Temperature,
            Value: 0
        }),
        new Property({
            endpoint: "3",
            deviceType: "sensorMultilevel",
            model: ProbeType.Temperature,
            Value: 0
        }),
        new Property({
            endpoint: "1",
            deviceType: "sensorMultilevel",
            model: ProbeType.Humidity,
            Value: 50
        }),
        new Property({
            endpoint: "1",
            deviceType: "sensorMultilevel",
            model: ProbeType.CO2,
            Value: 0
        }),
        new Property({
            endpoint: "1",
            deviceType: "sensorMultilevel",
            model: ProbeType.VOC,
            Value: 0
        })
    ];
    protected guardMode: number = -1;
    batteryVoltage: number = -1;

    manufacturerId: number = 923;
    productId: number = 10;
    productName: string = "unknown";
    productTypeId: number = 3;
}