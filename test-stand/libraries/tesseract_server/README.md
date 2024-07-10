# Сервер для решения капч

# Содержание
- [Установка](#установка)
- [Настройка платформы](#настройка-платформы)
- [Запуск](#запуск)
- [HTTP запрос](#http-запрос)


# Установка
Для работы симулятора требуется:<br>
`Tesseract 5`<br>
`curl`<br>
`Языковая модель для расшифровки капчи (на данный момент используется eas3_cap)`<br>

## Установка Tesseract 5
Порядок действий:<br>
1.Установка зависимостей<br>
`sudo apt-get install automake ca-certificates g++ git libtool libleptonica-dev make pkg-config`<br>

2.Распаковать приложенный архив с Tesseract 5 (tesseract.tar.xz)<br>
`tar -xf tesseract.tar.xz`<br>

3.Перейти в директорию с tesseract и собрать проект<br>
```sh
cd tesseract
sudo su
./autogen.sh
./configure
make
make install
ldconfig
```

Более подробно описание установки можно посмотреть тут:<br>
https://intdocs.eltex.loc/pages/viewpage.action?pageId=65276150 <br>
https://tesseract-ocr.github.io/tessdoc/Compiling-%E2%80%93-GitInstallation.html <br>

## Установка curl
```sh
sudo apt install curl
```

## Языковая модель
Необходимо поместить приложенную языковую модель в нужную дирректорию<br>
```sh
cp ./eas3_cap.traineddata /usr/local/share/tessdata
```

# Настройка платформы
Для корректной работы у платформы ( капчи которой будут расшифровываться ) в конфигурационном файле  vars/service_parameters.yml должны быть следующие настройки:<br>
```yml
  captcha:
    enable: true
    port:
      map: 8088
      export: true
    caseSensitive: false
    allowedSizes:
      - "312x45"
      - "270x40"
    instance: "captcha:8088"
    proportion: 100
  zscaptcha:
    enable: false
    port:
      map: 8089
      export: false
    caseSensitive: true
    instance: "zs-captcha:8089"
    proportion: 0

```

# Запуск
Запуск симулятора осуществляется командой:<br>
`./tesseract_server.bin /тут/место/где/развернут/tesseract тут.есть.адрес.сервера`

# HTTP запрос
## Расшифровать капчу
**Запрос:** POST `{host}:5109/captcha`
**Тело запроса (JSON):**
|Поле|Описание|
|---|---|
|id|ID капчи которую требуется расшифровать|
|host|Адрес платформы |

Пример тела запроса:
```json
{
    "id":"{{captcha_id}}",
    "host":"10.24.64.106"
}
```

**Тело ответа (JSON):** 
|Поле|Описание|
|---|---|
|answer|Текст капчи|

Пример тела ответа:
```json
{
    "answer": "Nx6T&m"
}
```