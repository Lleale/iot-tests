import paho.mqtt.client as mqtt
import ssl
import random
import os
from flask import Flask, request
ca_cert = os.path.abspath(__file__).replace(os.path.basename(__file__), 'ca_cert.crt')

clients = {}
channel_state = {}

def percent_to_dBm(percent):
    if percent == 1:
        return -100
    elif 100 > percent > 1:
        percent_dBm = {99: -21, 98: -24, 97: -27, 96: -29, 95: -32, 94: -33, 93: -35, 92: -36, 91: -37, 90: -38, 89: -40, 88: -41, 87: -42, 86: -43, 85: -44, 84: -45, 83: -46, 82: -47, 81: -48,
                       80: -49, 79: -50, 78: -51, 76: -52, 75: -53, 74: -54, 73: -55, 71: -56, 70: -57, 69: -58, 67: -59, 66: -60, 64: -61, 63: -62, 61: -63, 60: -64, 58: -65, 56: -66, 55: -67,
                       53: -68, 51: -69, 50: -70, 48: -71, 46: -72, 44: -73, 42: -74, 40: -75, 38: -76, 36: -77, 34: -78, 32: -79, 30: -80, 28: -81, 26: -82, 24: -83, 22: -84, 20: -85, 17: -86,
                       15: -87, 13: -88, 10: -89, 8: -90, 6: -91, 3: -92}

        percent_not_exist = [77, 72, 68, 65, 62, 59, 57, 54, 49, 47, 45, 43, 41, 39, 37, 35, 33, 31, 29, 27, 25, 23, 21, 19, 18, 16, 14, 12, 11, 9, 7, 5, 4, 2]
        for not_exist in percent_not_exist:
            if percent == not_exist:
                return percent_not_exist

        return percent_dBm[percent]
    elif percent == 100:
        return -1

def on_disconnect(client, userdata,rc=0):
    print("DisConnected result code "+str(rc))
    client.loop_stop()

def on_connect(client, userdata, flags, rc):
    print("Result from connect: {}".format(
        mqtt.connack_string(rc)))
    if rc == mqtt.CONNACK_ACCEPTED:
        print("subscribe nodeID", client._client_id.decode('UTF-8'))
        client.subscribe("dev/cmd/" + client._client_id.decode('UTF-8') + "/#", qos=0)

def on_message(client, userdata, msg):
    print("Message received. Topic: {}. Payload: {}".format(
        msg.topic,
        str(msg.payload)))
    if "/00250000" in msg.topic:
        get_nod, get_channel, _ = msg.topic[8::].split("/")
        channel_state[get_nod][int(get_channel)] = int(msg.payload)
        client.publish("dev/report/" + msg.topic[8::], msg.payload)
    if "/00310100" in msg.topic:
        client.publish("dev/report/" + msg.topic[8::], -random.randint(1, 99))

def add_SW_RLY01(node, host, port_broker, login="login", password="password"):
        client = mqtt.Client(str(node))
        client.username_pw_set(login, password)
        client.tls_set(
            ca_certs=ca_cert,
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLSv1_2,
        )
        client.on_connect = on_connect
        client.on_message = on_message
        client.on_disconnect = on_disconnect
        client.tls_insecure_set(True)
        client.connect(host, port=int(port_broker), keepalive=30)
        client.loop_start()
         # iface_added
        client.publish("sys/event/" + str(node), "node_add_start " + str(node) + "|923|4|1|1.5.0|1",0)
        client.publish("sys/event/" + str(node), "iface_added " + str(node) + "|0|00250000|0",0)
        client.publish("sys/event/" + str(node), "iface_added " + str(node) + "|1|00250000|1",0)
        client.publish("sys/event/" + str(node), "iface_added " + str(node) + "|0|00310100|-37",0)
        client.publish("sys/event/" + str(node), "iface_added " + str(node) + "|0|00A50200|0",0)
        client.publish("sys/event/" + str(node), "iface_added " + str(node) + "|0|00A40200|0",0)
        client.publish("sys/event/" + str(node), "iface_added " + str(node) + "|1|00A40200|0",0)
        # node_added
        client.publish("sys/event/" + str(node), "node_added " + str(node),0)
        # restart_reason
        client.publish("sys/event/" + str(node), "restart_reason 3")
        # adding_values
        for i in range(0, 2):
            client.publish("dev/report/" + str(node) + "/" + str(i) + "/00250000", "1")
        client.publish("dev/report/" + str(node) + "/0/00310100", -random.randint(1, 99))
        return client

def switching_channel_SW_RLY01(client, node, channel, state):
    client.publish("dev/report/" + str(node) + "/" + str(channel) + "/00250000", str(state))

def send_signal_strength_SW_RLY01(client, node, dBm):
    client.publish("dev/report/" + str(node) + "/0/00310100", dBm)

def disconnect_SW_RLY01(client, node):
    client.publish("sys/event/" + str(node) + "/LWT", "Offline")
    client.loop_stop()

def connect_SW_RLY01(client, node):
    client.publish("sys/event/" + str(node) + "/LWT", "Online")
    client.loop_start()

app = Flask(__name__)

@app.route('/add_node/<string:node>', methods=['POST'])
def add(node):
    brokerLogin = request.args.get('brokerLogin')
    brokerPassword = request.args.get('brokerPassword')
    brokerURL = request.args.get('brokerURL')
    if ":" in brokerURL:
        host,port_broker = brokerURL.split(":")
    else:
        host = brokerURL
        port_broker = "8883"
    if brokerLogin is not None and brokerPassword is not None:
        cl = add_SW_RLY01(node, host, port_broker, brokerLogin, brokerPassword)
        clients[node] = cl
        channel_state[node] = [0, 1]
        return '''SW_RLY01 with node {} added, brokerLogin = {}, brokerPassword = {} '''.format(node, brokerLogin, brokerPassword)
    else:
        cl = add_SW_RLY01(node, host, port_broker)
        clients[node] = cl
        channel_state[node] = [0, 1]
        return '''SW_RLY01 with node {} added'''.format(node)

@app.route('/node/<string:node>/channel/<int:channel>/position/<int:state>', methods=['POST'])
def switching_channel(node, channel, state):
    switching_channel_SW_RLY01(clients[node], node, channel, state)
    channel_state[node][channel] = state
    return '''SW_RLY01 with node {} switched channel {} to state {}'''.format(node, channel, state)

@app.route('/node/<string:node>/signal_strength/<int:percent>', methods=['POST'])
def signal_strength(node, percent):
    dBm = percent_to_dBm(percent)
    if type(dBm) == list:
        return {"message": "These percentages do not exist on the platform", "percentages": dBm}
    else:
        send_signal_strength_SW_RLY01(clients[node], node, dBm)
        return '''SW_RLY01 with node {} sent the value of the wi-fi signal level {} %'''.format(node, percent)

@app.route('/node/<string:node>/disconnect', methods=['POST'])
def disconnect_rly(node):
    disconnect_SW_RLY01(clients[node], node)
    return '''SW_RLY01 with node {} disconnect'''.format(node)

@app.route('/node/<string:node>/connect', methods=['POST'])
def connect(node):
    connect_SW_RLY01(clients[node], node)
    return '''SW_RLY01 with node {} disconnect'''.format(node)

@app.route('/node/<string:node>/channel/<int:channel>/state', methods=['GET'])
def get_channel_state(node, channel):
    return '''{}'''.format(channel_state[node][channel])

if __name__ == '__main__':
    app.run(port=5005)