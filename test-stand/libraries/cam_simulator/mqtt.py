import paho.mqtt.client as mqtt
import subprocess, shlex, threading
import string
import random
import re
import ssl
import json
import uuid
from datetime import datetime
import time

class MQTTUnit:
    def __init__(self, broker: str, port: int, login: str, password: str, nodeid: str, config, serialno: str = None) -> None:
        print(f'Created camera {nodeid}')

        self.streamDictLock = threading.Lock()
        self.streamEvent = threading.Event()

        self.mqttCreds = {
            "broker": broker, 
            "port": port, 
            "login": login, 
            "password": password
        }

        self.config = config
        # Loading property_list from file
        with open(self.config["Files"]['PropertyListFile'], 'r') as file:
            property_list: str = file.read()
            self.property_list = json.loads(property_list)

            self.property_index = {}
            for i in range(len(self.property_list['props'])):
                self.property_index[self.property_list['props'][i]['mqtt_topic']] = i
        
        # Default static funny stuff
        self.property_list['device_id'] = nodeid
        self.property_list['serial'] = serialno if serialno is not None else ''.join(random.choice(string.ascii_uppercase) for i in range(10))
        self.property_list['report_topic'] = f'dev/report/{nodeid}'
        self.property_list['cmd_topic'] = f'dev/cmd/{nodeid}'
        self.property_list['sys_cmd_topic'] = f'sys/cmd/{nodeid}'
        self.property_list['sys_event_topic'] = f'sys/event/{nodeid}'

        # Setting up rtsps
        self.property_list['props'][self.property_index['/stream/0/rtsp/url']]["value"] = f'rtsp://{self.config["MediaMTX"]["Address"]}:{self.config["MediaMTX"]["rtspport"]}/source{nodeid}main'
        self.property_list['props'][self.property_index['/stream/1/rtsp/url']]["value"] = f'rtsp://{self.config["MediaMTX"]["Address"]}:{self.config["MediaMTX"]["rtspport"]}/source{nodeid}sub'
        self.property_list['props'][self.property_index['/stream/2/rtsp/url']]["value"] = f'rtsp://{self.config["MediaMTX"]["Address"]}:{self.config["MediaMTX"]["rtspport"]}/source{nodeid}mob'

        self.launched_streams = {}

        self.__initMQTT()

    def __initMQTT(self):
        self.client = mqtt.Client(uuid.uuid4().hex)
        self.client.username_pw_set(self.mqttCreds['login'], self.mqttCreds['password'])
        
        # Security funny stuff
        if self.config["Files"].get("MQTTCertificate", None) is not None:
            self.client.tls_set(
                ca_certs=self.config["Files"]["MQTTCertificate"],
                cert_reqs=ssl.CERT_REQUIRED,
                tls_version=ssl.PROTOCOL_TLSv1_2,
            )
            
            isInsecureAllowed = self.config.getboolean("MQTTVariables", "AllowInsecure")
            if isInsecureAllowed:
                self.client.tls_insecure_set(isInsecureAllowed)


        # Handlers: connection
        self.client.on_connect = self.__onConnect
        self.client.on_connect_fail = self.__onConnectFailed
        self.client.on_disconnect = self.__onDisconnect

        # Handlers: communication
        self.client.on_message = self.__onMessage
        self.client.on_publish = self.__onPublish

        self.__setSpecialCommands()

        self.client.will_set(f'sys/event/{self.property_list["device_id"]}/LWT', 'Offline', 1, True)

        result = -1
        try:
            result = self.client.connect(self.mqttCreds['broker'], self.mqttCreds['port'], keepalive=30)
            self.client.loop_start()
        except:
            print(f'Connection failed (CODE = {result})')

    def __getstate__(self):
        self.streamEvent.set()
        state = {
            "mqtt_creds": self.mqttCreds,
            "property_list": self.property_list,
            "property_index": self.property_index,
            "config": self.config,
            "reset_callback": self.resetCallback if not None else None
        }

        return state

    def __setstate__(self, newstate):
        # Stored params
        self.mqttCreds = newstate['mqtt_creds']
        self.property_list = newstate['property_list']
        self.property_index = newstate['property_index']
        self.config = newstate['config']
        self.resetCallback = newstate['reset_callback']

        # Default params
        self.launched_streams = {}
        self.streamDictLock = threading.Lock()
        self.streamEvent = threading.Event()

        self.__initMQTT()
        
        # Enable previously enabled streams
        for streamid in range(0, 3):
            # rtsp_index = self.property_index[f'/stream/{streamid}/rtsp/onoff']
            rtmp_index = self.property_index[f'/stream/{streamid}/rtmp/onoff']

            # self.__runRTSP(self.property_list['props'][rtsp_index]['mqtt_topic'], self.property_list['props'][rtsp_index]['value'])
            self.__runRTMP(self.property_list['props'][rtmp_index]['mqtt_topic'], self.property_list['props'][rtmp_index]['value'])


    def cleanup(self):
        print(f'Deleted camera {self.property_list["device_id"]}')

        self.terminated = True
        self.client.publish(
                f'sys/event/{self.property_list["device_id"]}',
                f'node_removed {self.property_list["device_id"]}',
                0
        )

        for proc in self.launched_streams.values():
            proc.kill()
            proc.wait()
            print(proc.returncode)


        self.client.loop_stop(True)

    def __setSpecialCommands(self):
        self.special_dev = {
            "rtmp/onoff": self.__runRTMP,
            "time/get": self.__getTime,
            "reset": self.__reset
        }

        self.special_sys = {
            "ssdp on": self.__emulateSSDP,
            "ssdp off": self.__emulateSSDP
        }

    def __onDisconnect(self, client, userdata, rc):
        if rc == 0:
            print('Connection closed')
        else:
            print(f'Connection terminated (CODE = {rc})')

    def __onConnectFailed(self, client, userdata):
        print('Failed to connect...')

    def __onConnect(self, client, userdata, flags, rc):
        if rc == 0:
            print('Connection established')

            # Подписываемся на топики
            self.client.subscribe(f'{self.property_list["cmd_topic"]}/#')
            self.client.subscribe(f'{self.property_list["sys_cmd_topic"]}')

            # Отправляем проперти лист

            self.client.publish(
                f'sys/json/event/{self.property_list["device_id"]}',
                json.dumps(self.property_list, indent=4),
                0
            )
            print('Sent property list')


            # LWT
            self.client.publish(f'sys/event/{self.property_list["device_id"]}/LWT', 'Online', 1, True)
            print('Sent lwt')

        else:
            print(f'Connection failed (CODE = {rc})')

            
    def __onPublish(self, client, userdata, mid):
        print(f'Message published, MID = {mid}')
        
    def __sysMessage(self, client, userdata, message):
        command = message.payload.decode('utf-8')

        # Special commands handler
        action = [item for item in self.special_sys.keys() if item in command]
        if len(action) != 0:
            self.special_sys[action[0]](command)

    def __devMessage(self, client, userdata, message):
        command = message.topic.replace(self.property_list['cmd_topic'], '')
        payload = message.payload.decode("utf-8")

        if command not in self.property_index:
            return

        # Special commands handler
        action = [item for item in self.special_dev.keys() if item in command]
        if len(action) != 0:
            self.special_dev[action[0]](command, payload)

        elif self.property_list['props'][self.property_index[command]]['value'] != payload:
            # Report new value
            self.client.publish(f'{self.property_list["report_topic"]}{command}', payload)

        self.property_list['props'][self.property_index[command]]['value'] = payload

    def __onMessage(self, client, userdata, message):
        print(f'Command "{message.topic}" received')
        
        if message.topic.startswith('dev'):
            self.__devMessage(client, userdata, message)
        elif message.topic.startswith('sys'):
            self.__sysMessage(client, userdata, message)
    
    def __execShellCmd(self, cmd, streamid):
        args = shlex.split(cmd)
        proc = subprocess.Popen(
            args=args,
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE
        )

        with self.streamDictLock:
            self.launched_streams[f'rtmp{streamid}'] = proc

        print(f'Now launched {len(self.launched_streams)} streams...')
        return proc

    def __procMonitor(self, cmd, streamid):
        proc = self.__execShellCmd(cmd, streamid)
        
        while True:
            if self.streamEvent.is_set():
                print(f'Thread stop required! {proc.pid} wont start again...')
                proc.kill()
                return
            
            print(f'Monitor start {proc.pid}')
            proc.wait()

            if proc.returncode != -9:
                print(f'{proc.pid} crashed! Restarting...')

                proc = self.__execShellCmd(cmd, streamid)
                # onDoneCallback(*callbackArgs)
                time.sleep(1.5)
            else:
                print(f'{proc.pid} peacefully died...')
                return

    def __runRTMP(self, command, payload):
        streamid = re.findall(r'\d+', command)[0]

        # Если надо запустить и еще не запущенно
        if payload == '1' and f'rtmp{streamid}' not in self.launched_streams.keys():
            with open(self.config['Files']['rtmpcommandfile'], 'r') as cmdfile:
                # Формируем команду 
                cmd = cmdfile.read().format(
                    localtarget=f'rtsp://{self.config["MediaMTX"]["address"]}:{self.config["MediaMTX"]["rtspport"]}/datapool',
                    location=self.property_list['props'][self.property_index[f'/stream/{streamid}/rtmp/url']]['value']
                )
            print(f'Final cmd:\n{cmd}')
            thread = threading.Thread(target=self.__procMonitor, args=(cmd, streamid))
            thread.start()

            self.client.publish(f'{self.property_list["report_topic"]}{command}', payload)

        # Если надо вырубить и запущенно
        elif payload == '0' and f'rtmp{streamid}' in self.launched_streams.keys():
            with self.streamDictLock:
                popped = self.launched_streams.pop(f'rtmp{streamid}')

            popped.kill()
            self.client.publish(f'{self.property_list["report_topic"]}{command}', payload)


    def __getTime(self, command, payload):
        self.client.publish(f'{self.property_list["report_topic"]}{command}', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

    def __emulateSSDP(self, command: str):
        if 'ssdp on' in command:
            usn = command.split('|')[1]
            self.client.publish(f'{self.property_list["report_topic"]}/ssdp/usn', usn)
            self.client.publish(f'{self.property_list["report_topic"]}/ssdp/onoff', 1)
            self.client.publish(f'{self.property_list["sys_event_topic"]}', "ssdp started")
        else:
            self.client.publish(f'{self.property_list["report_topic"]}/ssdp/onoff', 0)
            self.client.publish(f'{self.property_list["sys_event_topic"]}', "ssdp stopped")

    def __reset(self, command, payload):
        print('Camera reset init')
        self.resetCallback(self)

    def getRunningStreams(self):
        return self.launched_streams
