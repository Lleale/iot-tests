import Device, { ProbeType } from "../../device.js";
import ProbeMap from "../../probe_map.js";

export default class GlcpUtils {

    static probeMap: ProbeMap = new ProbeMap(
        [
            [ProbeType.Tamper, "tamper"],
            [ProbeType.OpenClose, "magnet"],
            [ProbeType.WaterLeak, "sensor_wleak.aq1"],
            [ProbeType.Motion, "motion"],
            [ProbeType.GlassBreak, "vibration"],
            [ProbeType.Smoke, "smoke"],
            [ProbeType.CO2, "co2"],
            [ProbeType.Humidity, "sensor_ht"],
            [ProbeType.Temperature, "sensor_ht"],
            [ProbeType.VOC, "voc"],
            [ProbeType.Illumination, "luminosity"],
        ]);

    static propertyValueMap: ProbeMap = new ProbeMap(
        [
            [ProbeType.Tamper, "status"],
            [ProbeType.OpenClose, "status"],
            [ProbeType.WaterLeak, "status"],
            [ProbeType.Motion, "status"],
            [ProbeType.GlassBreak, "status"],
            [ProbeType.Smoke, "status"],
            [ProbeType.CO2, "ppm"],
            [ProbeType.Humidity, "humidity"],
            [ProbeType.Temperature, "temperature"],
            [ProbeType.VOC, "ppb"],
            [ProbeType.Illumination, "lux"],
        ]);

    static getSid(device: Device): string {
        return device.nodeId.toString().padEnd(7, "0") + device.nodeId.toString().padStart(7, "0");
    }
}