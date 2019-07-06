import I2C from "i2c-bus";
import { debug as debugInit } from "debug";
import { sleep } from "sleep";
const debug = debugInit("CCS811")

function map(x: number, in_min: number, in_max: number, out_min: number, out_max: number): number {
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

export class CCS811 {
    static Address = 0x5b;
    
    i2c: I2C.I2cBus
    
    constructor() {

        this.i2c = I2C.openSync(1);
        debug("Reset")
        // Reset
        this.i2c.writeI2cBlockSync(CCS811.Address, 0xff, 4, Buffer.from([0x11,0xE5,0x72,0x8A]))

        sleep(1);
        // Status
        debug("status 0x0: 0x"+this.i2c.readByteSync(CCS811.Address, 0x00).toString(16))

        sleep(1);
        // START
        this.i2c.sendByteSync(CCS811.Address, 0xF4);

        sleep(1);
        // Status
        debug("status 0x0: 0x"+this.i2c.readByteSync(CCS811.Address, 0x00).toString(16))
        debug("HWID: 0x20: 0x81 = 0x"+this.i2c.readByteSync(CCS811.Address, 0x20).toString(16))
        debug("0xe0: 0x"+this.i2c.readByteSync(CCS811.Address, 0xe0).toString(16))
        debug("app_ver 0x24: 0x"+this.i2c.readWordSync(CCS811.Address, 0x24).toString(16))
        debug("MEAS: 0x"+this.i2c.readWordSync(CCS811.Address, 0x01).toString(16))
        debug("update MEAS!")
        this.i2c.writeByteSync(CCS811.Address, 0x01, 0x10);
        console.log("MEAS: 0x"+this.i2c.readByteSync(CCS811.Address, 0x01).toString(16))
        
    }

    readData(): {co2: number, tvoc: number} {

        const buffer = Buffer.alloc(5);
        this.i2c.readI2cBlockSync(CCS811.Address, 0x02, 5, buffer)
        debug(buffer);

        const co2_raw = (buffer[0] << 8) | buffer[1];
        const tvoc_raw = (buffer[2] << 8) | buffer[3];

        const co2 = map(co2_raw, 0, 0xffff, 400, 8192);
        const tvoc = map(tvoc_raw, 0, 0xffff, 0, 1187)

        debug("CO2 raw: ", co2_raw);
        debug("TVOC raw: ", tvoc_raw);
        debug("CO2: ", co2, "ppm");
        debug("TVOC: ", tvoc, "ppb");

        return {co2, tvoc};
    }

    writeEnvironmentData(temperature: number, humidity: number): void {
        
        const buffer = Buffer.alloc(4);
        
        const h = (humidity * 1000) >> 0; // 42.348 becomes 42348
        let t = (temperature * 1000) >> 0; // 23.2 becomes 23200
    
        buffer[0] = ((h + 250) / 500) >> 0
        buffer[1] = 0 // CCS811 only supports increments of 0.5 so bits 7-0 will always be zero
        
        t += 25000 // Add the 25C offset
        buffer[2] = ((t + 250) / 500) >> 0
        buffer[3] = 0
        debug("Environment data buffer: ", buffer);

        this.i2c.writeI2cBlockSync(CCS811.Address, 0x05, 4, buffer)
    }
}
