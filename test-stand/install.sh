#!/usr/bin/env bash
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )


#Проверка на флаг обновления
if test "$1" != "--update"; then

    #Если флага нет, то устанавливаем абсолютно все зависимости
    echo "Installing test stand..."

    #Проверка на запуск от имени суперпользователя
    if [[ $(/usr/bin/id -u) -ne 0 ]]; then
        echo "Not running as root"
        exit
    fi

    #Установка node v18
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs

    #Глобальная установка zx, allure и ts-node (требуется только один раз)
    npm install -g zx allure-commandline ts-node
else
    echo "Updating test stand..."
fi

#Установка локальных зависимостей тестового стенда
cd ${parent_path}
npm set install-links false
npm install --omit=optional --omit=dev --no-audit --prefer-offline
echo "Done!"
