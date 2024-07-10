import { ProbeType } from "./device";

export default class ProbeMap {

    private k1_k2: Map<ProbeType, string> = new Map<ProbeType, string>();
    private k2_k1: Map<string, ProbeType> = new Map<string, ProbeType>();

    constructor(keys: [ProbeType, string][]) {
        for (let [key1, key2] of keys) {
            this.k1_k2.set(key1, key2);
            this.k2_k1.set(key2, key1);
        }
    }

    getName(key: ProbeType): string {
        return this.k1_k2.get(key);
    }

    getType(key: string): ProbeType {
        return this.k2_k1.get(key);
    }
}