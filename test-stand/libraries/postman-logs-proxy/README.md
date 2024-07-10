# Postman-logs-proxy

# Содержание
- [Установка и запуск](#установка-и-запуск)
- [HTTP запросы](#http-запросы)


# Установка и запуск
Для работы симулятора требуется python:<br>
`sudo apt install python3.8`

Также необходим sshpass:<br>
`sudo apt install sshpass`

Кроме того, перед запуском необходимо поключится по ssh к хосту с которого планируется стягивать логи с того хоста на котором развернут Postman-logs-proxy, для того создался ключ ssh и удаленный хост был добавлен list of known hosts. Данную процедуру достаточно провести один раз.:<br>
`sudo ssh user@host`

Запуск симулятора осуществляется командой:<br>
`sudo ./postman-logs-proxy.bin`


# HTTP запросы
## Скопировать логи платформы в папку с данной утилитой

**Запрос:** POST `{host}:5012/copy_log`

**Тело запроса (JSON):** 
|Поле|Описание|
|---|---|
|host|Адрес сервера с которого надо стянуть логи|
|user|Пользователь ssh на сервере с которого надо стянуть логи|
|password|Пароль ssh на сервере с которого надо стянуть логи|
|logs_dir|Дирректория где лежат логи|

**Тело ответа :** The log was copied

---

## Скопировать логи с произвольным именем в папку с данной утилитой

**Запрос:** POST `{host}:5012/copy_non_default_name_log`

**Тело запроса (JSON):** 
|Поле|Описание|
|---|---|
|host|Адрес сервера с которого надо стянуть логи|
|user|Пользователь ssh на сервере с которого надо стянуть логи|
|password|Пароль ssh на сервере с которого надо стянуть логи|
|logs_dir|Дирректория где лежат логи|
|name_log|Название файла с логами|

**Тело ответа :** The log was copied

---
## Вернуть логи платформы за указанное время в ответе на запрос
**Запрос:** POST `{host}:5012/return_log_iot`

|Поле|Описание|
|---|---|
|host|Адрес сервера с которого надо стянуть логи|
|user|Пользователь ssh на сервере с которого надо стянуть логи|
|password|Пароль ssh на сервере с которого надо стянуть логи|
|logs_dir|Дирректория где лежат логи|
|time_start|Время с которого будут возвращены логи Timestamp в секундах (число)|
|time_end|Время до которого будут возвращены логи Timestamp в секундах (число)|
 yours_time_zone| Таймзона в которой передаются time_start, time_end (например "yours_time_zone": "Asia/Novosibirsk +07") |

**Тело ответа :** Массив с логами (каждая строка отдельный элемент), пример:<br>
`[
    "2023-05-31 16:14:49.054  [qtp18794137-53] DEBUG MeterParentModule.deleteControllerInMemory:363 controller id: a6e2f2c3-9e2a-48e6-9001-98fe8ab81bfa remove from memory and remove devices\n",
    "userId:3____2\n",
    "2023-05-31 16:14:49.055  [qtp18794137-53] DEBUG ControllerService.deleteController:205 delete controller from db: a6e2f2c3-9e2a-48e6-9001-98fe8ab81bfa\n",
    "userId:3____3\n",
    "2023-05-31 16:14:49.077  [bulkhead-eventlog-3] DEBUG EventLogRemoteDataService.save:142 save: uri = http://olapservice:8023; save LogDescription = LogDescription{time=1685524489077, houseId='a6e2f2c3-9e2a-48e6-9001-98fe8ab81bfa', originType=USER, originId='75569c74-738e-43c7-9faf-7f1b0cd35894', sectionIds=null, color=DANGER, msgLevel=USER, msgType=house_remove, msgGroup=MANAGEMENT_HOUSES, msgText='houseRemove', iconName='house_remove', params={houseTitle=1, username=another_user}, links=null}\n",
    "2023-05-31 16:14:49.089  [ForkJoinPool.commonPool-worker-3] DEBUG EventLogRemoteDataService.lambda$save$1:176 save: response status: 200\n",
    "2023-05-31 16:14:49.091  [qtp18794137-53] DEBUG EltexVideoUserService.deleteUser:244 deleteUser <- Delete eltex evi user, userId = 75569c74-738e-43c7-9faf-7f1b0cd35894\n",
    "userId:3_____4\n"
]
`