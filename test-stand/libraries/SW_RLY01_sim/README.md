# Симулятор устройства SW_RLY01

# Содержание
- [Установка и запуск](#установка-и-запуск)
- [HTTP запросы](#http-запросы)


# Установка и запуск
Для работы симулятора требуется python3.8:<br>
`sudo apt install python3.8`

Запуск симулятора осуществляется командой:<br>
`./SW_RLY01_sim.bin`


# HTTP запросы
## Добавление устройства

**Запрос:** POST `{host}:5005/add_node/{nodeID}?brokerLogin={brokerLogin}&brokerPassword={brokerPassword}&brokerURL={brokerURL}`

**Тело ответа :** SW_RLY01 with node {nodeID} added, brokerLogin = {brokerLogin}, brokerPassword = {brokerPassword}

---
## Переключение каналов
**Запрос:** POST `{host}:5005/node/{nodeID}/channel/{channel}/position/{position}`

channel это канал, может быть 0 или 1.
position это состояние, в которое переключится канал, может быть 0 или 1.

**Тело ответа :** SW_RLY01 with node {nodeID} switched channel {channel} to state {position}

---
## Отправка уровня Wi-Fi сигнала
**Запрос:** POST `{host}:5005/node/{nodeID}/signal_strength/{percent}`

**Тело ответа :** SW_RLY01 with node {nodeID} sent the value of the wi-fi signal level {percent} %

Примечание, так как на платформе на может быть (http://red.eltex.loc/issues/229044), некоторый значений уровня Wi-Fi сигнала, в случае если производилась попытка установить такое значение приходит ответ

**Тело ответа (JSON):** 
|Поле|Описание|
|---|---|
|message|Сообщение об ошибке|
|percentages|Список значений процентов силы Wi-Fi сигнала, которых нет на платформе|

## Отключение устройства (устройство становится недоступно с платформы)
**Запрос:** POST `{host}:5005/node/{nodeID}/disconnect`

**Тело ответа:** SW_RLY01 with node {nodeID} disconnect

---
## Подключение устройства
**Запрос:** POST `{host}:5005/node/{nodeID}/connect`

**Тело ответа:** SW_RLY01 with node {nodeID} connect

---
## Запрос состояния канала (вкл/выкл)
**Запрос:** GET `{host}:5005/node/{nodeID}/channel/{channel}/state`

**Тело ответа:** {channel_state}
