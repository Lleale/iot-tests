import os
import datetime
from flask import Flask, request
import pytz

dir = os.path.abspath('postman-logs-proxy.bin').replace(os.path.basename('postman-logs-proxy.bin'), '')

def copy_log_ssh_and_time_zone(password, user, host, logs_dir, name_log='server.log'):
    os.system(f'sshpass -p "{password}" scp {user}@{host}:{logs_dir}/{name_log} {dir}')
    server_time_zone = os.popen(f'sshpass -p "{password}" ssh {user}@{host} "timedatectl"').read()
    for i in server_time_zone.split('\n'):
        if 'Time zone' in i:
            tz = i.split(',')[1].split(' ')[1][:3]
            break;
    return tz

def log_parser(time_start, time_end):
    f = open(dir + 'server.log')
    lines = f.readlines()
    f.close()
    logs = []

    for i in range(0, len(lines)):
        # date_start != date_end
        if time_start.split(" ")[0] != time_end.split(" ")[0]:
            # date < date_end
            if time_start.split(" ")[0] <= lines[i].split(" ")[0] and time_end.split(" ")[0] > lines[i].split(" ")[0]:
                # print(lines[i])
                # time
                if (lines[i].split(" ")[1].split(".")[0] >= time_start.split(" ")[1] and time_start.split(" ")[0] == lines[i].split(" ")[0]) or (time_end.split(" ")[1] >= lines[i].split(" ")[1].split(".")[0] and  time_start.split(" ")[0] != lines[i].split(" ")[0]):
                    logs.append(lines[i])
                    while i != len(lines) - 1 and time_start.split(" ")[0] not in lines[i + 1] and time_end.split(" ")[0] not in lines[i + 1]:
                        logs.append(lines[i + 1])
                        i += 1

            # date == date_end
            elif time_start.split(" ")[0] <= lines[i].split(" ")[0] and time_end.split(" ")[0] == lines[i].split(" ")[0]:
                # time
                if lines[i].split(" ")[1].split(".")[0] <= time_end.split(" ")[1]:
                    logs.append(lines[i])
                    while i != len(lines)-1:
                        try:
                            datetime.datetime.strptime(lines[i+1].split(" ")[0], '%Y-%m-%d')
                            break
                        except:
                            logs.append(lines[i+1])
                            i += 1
        # date_start == date_end
        else:
            # date == date_end == date_start
            if lines[i].split(" ")[0] == time_end.split(" ")[0] == time_start.split(" ")[0]:
                # time
                if lines[i].split(" ")[1].split(".")[0] >= time_start.split(" ")[1] and lines[i].split(" ")[1].split(".")[0] <= time_end.split(" ")[1]:
                    logs.append(lines[i])
                    while i != len(lines) - 1 and time_start.split(" ")[0] not in lines[i + 1]:
                        try:
                            datetime.datetime.strptime(lines[i+1].split(" ")[0], '%Y-%m-%d')
                            break
                        except:
                            logs.append(lines[i+1])
                            i += 1

    return logs

app = Flask(__name__)
@app.route('/copy_log', methods=['POST'])
def copy_log():
    data = request.get_json()
    copy_log_ssh_and_time_zone(data['password'], data['user'], data['host'], data['logs_dir'])
    return '''The log was copied'''

@app.route('/copy_non_default_name_log', methods=['POST'])
def copy_non_default_name_log():
    data = request.get_json()
    copy_log_ssh_and_time_zone(data['password'], data['user'], data['host'], data['logs_dir'], data['name_log'])
    return '''The log was copied'''

@app.route('/return_log_iot', methods=['POST'])
def return_log():
    data = request.get_json()
    server_time_zone = copy_log_ssh_and_time_zone(data['password'], data['user'], data['host'], data['logs_dir'])
    time_start = int(data['time_start']) - (int(data['yours_time_zone'].split(' ')[1]) * 3600) + (int(server_time_zone) * 3600)
    time_end = int(data['time_end']) - (int(data['yours_time_zone'].split(' ')[1]) * 3600) + (int(server_time_zone) * 3600)
    print(f'time_start in logs (yours_time_zone = {data["yours_time_zone"]} , server_time_zone = {server_time_zone} )', datetime.datetime.fromtimestamp(int(time_start),pytz.timezone(data['yours_time_zone'].split(' ')[0])).strftime('%Y-%m-%d %H:%M:%S'))
    print(f'time_end in logs (yours_time_zone = {data["yours_time_zone"]}, , server_time_zone = {server_time_zone} )', datetime.datetime.fromtimestamp(int(time_end),pytz.timezone(data['yours_time_zone'].split(' ')[0])).strftime('%Y-%m-%d %H:%M:%S'))
    time_start = datetime.datetime.fromtimestamp(int(time_start),pytz.timezone(data['yours_time_zone'].split(' ')[0])).strftime('%Y-%m-%d %H:%M:%S')
    time_end = datetime.datetime.fromtimestamp(int(time_end),pytz.timezone(data['yours_time_zone'].split(' ')[0])).strftime('%Y-%m-%d %H:%M:%S')
    logs = log_parser(time_start, time_end)
    return logs

if __name__ == '__main__':
    app.run(port=5012)