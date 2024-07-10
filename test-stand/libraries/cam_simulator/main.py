from flask import Flask, request, Response
from mqtt import MQTTUnit
import json
import argparse, configparser
import pickle
import signal
import sys
import requests

app = Flask(
    __name__
)

# Called on MQTT RESET command
def cameraResetCallback(cameraObj: MQTTUnit):
    reseted = activeCameras.pop(cameraObj.property_list['device_id'])
    reseted.cleanup()
    print('Camera reset done')

@app.route('/add', methods=['POST'])
def add():
    body = request.get_json()
    if body['generatedNodeId'] in activeCameras:
        return Response(status=304)

    # Split broker line into address & port
    broker, port = str(body['brokerURL']).split(':')
    activeCameras[body['generatedNodeId']] = MQTTUnit(
        broker,
        int(port),
        body['generatedBrokerLogin'],
        body['generatedBrokerPassword'],
        body['generatedNodeId'],
        config,
        body['serial'] if 'serial' in body else None,
    )

    activeCameras[body['generatedNodeId']].resetCallback = cameraResetCallback

    return Response(body['generatedNodeId'], status=200)

@app.route('/remove', methods=['DELETE'])
def remove():
    body = request.get_json()
    removed = 0
    for nodeid in body['nodeid']:
        result = activeCameras.pop(nodeid, None)
        if result is not None:
            removed += 1
            # Stop all streams
            result.cleanup()

    return Response(str(removed), status=200)

# List of active cameras
@app.route('/active', methods=['GET'])
def getActiveCameras():
    return Response(
        json.dumps(list(activeCameras.keys())), 
        status=200,
        mimetype='application/json'
    )

# Info about exact camera
@app.route('/info', methods=['POST'])
def getCameraInfo():
    body = request.get_json()

    info = {
        'nodeid': body['nodeid'],
        'active_streams': list(activeCameras[body['nodeid']].getRunningStreams().keys()),
        'property_list': activeCameras[body['nodeid']].property_list
    }

    return Response(
        json.dumps(info), 
        status=200,
        mimetype='application/json'
    )

def launch_datapool(cmdfile):
    isDatapoolInternal = config.getboolean('MediaMTX', 'datapoolinternal')
    requestBody = {
        'source': config["MediaMTX"]["datapooladdress"],
    }

    if isDatapoolInternal:
        with open(cmdfile, 'r') as file:
            cmd = file.read().format(
                videobitrate=config["Video"]["videobitrate"],
                audiobitrate=config["Video"]["audiobitrate"],
                framerate=config["Video"]["framerate"],
                width=config["Video"]["width"],
                height=config["Video"]["height"],
                localtarget=config["MediaMTX"]["datapooladdress"]
            )

        # Filling in request params 
        requestBody['sourceOnDemand'] = False
        requestBody['runOnInit'] = cmd
        requestBody['runOnInitRestart'] = True

    
    # Trying create path 'Datapool'
    response = requests.post(
        f'http://{config["MediaMTX"]["address"]}:{config["MediaMTX"]["httpport"]}/v3/config/paths/add/datapool',
        json=requestBody)
    
    # On 'Already Exists' MediaMTX return 400 =_=
    if response.status_code != 400:
        print('[Created] MediaMTX initialized ')
        return
    
    # If 'Already Exists' or whatever trying to modify probably existing datapool
    response = requests.patch(
        f'http://{config["MediaMTX"]["address"]}:{config["MediaMTX"]["httpport"]}/v3/config/paths/patch/datapool',
        json=requestBody)
    
    # More logs in MediaMTX logs
    if response.status_code != 200:
        print('Error initializing MediaMTX for work!')
    else:
        print('[Patched] MediaMTX initialized ')
    
def init(startargs):
    if hasattr(startargs, 'config'):
        global config
        config = configparser.ConfigParser()
        config.read(startargs.config)
        launch_datapool(config['Files']['datapoolcommandfile'])

    global activeCameras
    if hasattr(startargs, 'database'):
        global databasepath
        databasepath = startargs.database
        print(f'Camera database is {databasepath}')
        signal.signal(signal.SIGINT, sigint_handler)

        print(f'Trying to read {databasepath}')
        try:
            with open(databasepath, 'rb') as database_file:
                activeCameras = pickle.load(database_file)
            print(f'Previously saved {len(activeCameras)} cameras loaded!')
        except Exception as e:
            print(e)
            print(f'Probably, there is no \'{databasepath}\' out there... Skippin\'')
            activeCameras = {}
    else:
        activeCameras = {}

    httpAddr = config['HTTPVariables']['host']
    httpPort = int(config['HTTPVariables']['port'])

    app.run(httpAddr, httpPort)

def sigint_handler(sig, frame):
    print('Manual stop requested! Save active cameras...')

    with open(databasepath, 'wb+') as database_file:
        pickle.dump(activeCameras, database_file)

    sys.exit(0)

parser = argparse.ArgumentParser(
    'Camera Simulator'
)

parser.add_argument('-c', '--config', help='Path to config file')
parser.add_argument('-d', '--database', help='Path to file to store previously known cameras :P')
args = parser.parse_args()
init(args)
