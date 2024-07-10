import { ProbeType } from "../../device.js";
import ProbeMap from "../../probe_map.js";

export default class O7Utils {
    static probeMap: ProbeMap = new ProbeMap(
        [
            [ProbeType.Tamper, "tamper"],
            [ProbeType.OpenClose, "door-window"],
            [ProbeType.WaterLeak, "flood"],
            [ProbeType.Motion, "motion"],
            [ProbeType.GlassBreak, "glass"],
            [ProbeType.Smoke, "smoke"],
            [ProbeType.CO2, "co2"],
            [ProbeType.Humidity, "humidity"],
            [ProbeType.Temperature, "temperature"],
            [ProbeType.VOC, "voc"],
            [ProbeType.Illumination, "luminosity"],
        ]);
}