# Симулятор устройства HVC-10*/SV-C0*

# Содержание
- [Установка и запуск](#установка-и-запуск)
- [Настройка MediaMTX](#настройка-mediamtx)
- [Редактирование config.ini](#редактирование-configini)
- [HTTP запросы](#http-запросы)

# Установка и запуск
Для работы симулятора требуется python3.10.12:<br>
`sudo apt install python3`<br>
Также для работы требуется ffmpeg не менее version 4.4.2-0ubuntu0.22.04.1<br>
`sudo apt install ffmpeg`<br>
Необходимо использовать **MediaMTX** не менее 1.5.1<br>
Для этого соберите `https://github.com/bluenviron/mediamtx` или выгрузите релиз 1.5.1 `https://github.com/bluenviron/mediamtx/releases/tag/v1.5.1`

Запуск симулятора осуществляется командой:<br>
`./main.bin -c [config.ini] -d [database file]`

* -c | --config - обязательный параметр
* -d | --database - не обязательный параметр. В случае, если указан, то текущее состояние симулятора будет сохранено в файл, а при запуске состояние будет подгружаться из файла

---
# Настройка MediaMTX
Для корректной работы симулятора камер необходимо предварительно настроить MediaMTX. Для этого, в конец файла необходимо добавить следующее:

```yml
paths:
  all_others:
    source: rtsp://localhost:8554/datapool
    sourceOnDemand: yes
```

При необходимости можно изменить у **datapool** прослушиваемый порт, но тогда эти же изменения надо будет внести в файл **config.ini**

Также необходимо разрешить взаимодействие по **API**, для этого отредактируйте конфиг следующим образом

```yml
# Enable controlling the server through the API.
api: yes
# Address of the API listener.
apiAddress: 0.0.0.0:9997
```

---
# Редактирование config.ini
```ini
[Files]
rtspcommandfile = rtsp <--- Путь до файла с командой для запуска RTSP потока
rtmpcommandfile = rtmp <--- Путь до файла с командой для запуска RTMP потока
datapoolcommandfile = datapool <--- Путь до файла с командой запуска Datapool* потока
propertylistfile = property_list <--- Путь до файла с параметрами камеры
mqttcertificate = ca_cert.crt <--- Путь до файла с сертификатом для MQTT

[MQTTVariables]
allowinsecure = True <--- Параметр для MQTT (по умолчанию включен для работы с локальным и облачным брокером)

[HTTPVariables] <--- Адрес и порт, на которых будет развернут веб-сервер
host = 0.0.0.0 
port = 1337

[MediaMTX]
datapooladdress = udp://0.0.0.0:1234 <--- Адрес главного потока (для MediaMTX)
datapoolinternal = True <--- Если подразумевается, что MediaMTX сам должен будет развернуть генератор
address = 192.168.1.45
rtspport = 8554
httpport = 9997

[Video]
width = 1920
height = 1080
framerate = 25
videobitrate = 1500K
audiobitrate = 128k
```

# HTTP запросы
## Добавление устройства

**Запрос:** POST `{host}:{port}/add`

**Тело запроса:** 
```json
{
    "brokerURL": "{url}:{port}",
    "generatedBrokerLogin": "{login}",
    "generatedBrokerPassword": "{password}",
    "generatedNodeId": "{nodeid}"
}
```
В запрос прикладывается тело ответа на запрос 
`{{host}}/ctl/{{controllerId}}/devices/generateMqttBrokerInfo?deviceType=camera`

**Тело ответа:** `{nodeid}`

---
## Просмотр активных камер
**Запрос:** GET `{host}:{port}/active`

В ответ возвращается список симулируемых камер

**Тело ответа :** 
```json
[
    "{nodeid1}",
    "{nodeid2}"
]
```

---
## Удаление ряда камер
**Запрос:** DELETE `{host}:{port}/remove`<br>
С помощью команды можно удалить ряд симулируемых камер (с остановкой потоков)<br>
**Тело запроса:**
```json
{
    "nodeid": [
        "{nodeid1}",
        "{nodeid2}"
    ]
}
```

**Тело ответа :** Количество удаленных камер

---
## Получение информации о конкретной камере
Под информацией о конкретной камере подразумевается ее property_list, node_id для генерации (дублирует значение device_id из property_list), а также список активных потоков.

Имя потока состоит из двух частей:
1. Протокол передачи - `RTSP` или `RTMP`
2. Идентификатор потока - 0 = main; 1 = sub; 2 = mob;

**Запрос:** GET `{host}:{port}/info`<br>
**Тело запроса:**
```json
{
    "nodeid": "{nodeid}"
}
```
**Тело ответа:**
```json
{
    "nodeid": "{nodeid}",
    "active_streams": [
        "rtsp0",
        "rtmp1"
    ],
    "property_list": {
        ...
    }
}
```

---
## Управление камерами
Все управление камерами происходит по MQTT. Особым образом обрабатываются только команды:
1. Изменение состояния потока: `dev/cmd/{nodeid}/stream/{streamid}/rtsp/onoff` или `dev/cmd/{nodeid}/stream/{streamid}/rtmp/onoff`
2. Сброс настроек: `dev/cmd/{nodeid}/reset` -- при выполнении указанной команды симулируемая камера автоматически удаляется из списка активных камер и закрывает все потоки. Аналогичное поведение будет при удалении через запрос `{host}:{port}/remove`
3. Получение текущего времени: `dev/cmd/{nodeid}/time/get`
4. Включение SSDP через топик `sys/cmd/{nodeid}`

Для всех остальных случаев, переданное в теле команды значение будет возвращено в неизменном виде в соответствующий **report** топик:
1. Для `dev/cmd` -> `dev/report`
2. Для `sys/cmd` -> `sys/event`
