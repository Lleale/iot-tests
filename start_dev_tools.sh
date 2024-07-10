#!/bin/bash

cd test-stand/libraries/postman-websocket-proxy/
node index.mjs &

cd ../zwave-ctl-sim/
node --loader ts-node/esm ./src/index.ts &

cd ../SW_RLY01_sim/
./SW_RLY01_sim.bin &

cd ../cam_simulator/
./mediamtx &
python3 main.py -c config.ini &

wait
