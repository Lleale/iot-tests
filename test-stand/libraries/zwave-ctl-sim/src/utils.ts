
export default class Utils {
    static syncSleep(milliseconds: number): void {
        if (milliseconds > 0)
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
    }

    static async sleep(ms): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static hidePrivate(obj) {
        var dup = {};
        for (var key in obj) {
            if (key.indexOf('_') == -1) {
                dup[key] = obj[key];
            }
        }
        return dup;
    }
}