import {MongoClient} from 'mongodb'
import express from 'express'
import {pathToFileURL} from 'url'

const app = express()
const port_express = 3073

// чтобы парсить body
app.use(express.json({ extended: true }))
// Чтобы парсить javascript из запроса
const javascript_parser = express.text({ type: 'application/javascript' });

var url_mongo;
var server;

app.post('/url',
        async (req, res) => {
        try {
            
                console.log('post /url')
                console.log('Body', req.body)
                const {url, port} = req.body
                url_mongo = 'mongodb://' + url + ':' + port 
                res.status(200).json({ message: 'Вы передали url и port для подключения к mongodb' })
                return url_mongo;
            }
        catch(e){
            console.log(e)
            res.status(500).json({message: "Server Error"})
        }
      })

    app.post('/find_one_by_id',   
        async (req, res) => {
        try {
                console.log('post /find_one_by_id')
                console.log('Body', req.body)
                const {dbName, collection, id} = req.body
                console.log(url_mongo)
                const client = new MongoClient(url_mongo);
                await client.connect()
                // console.log("connect")
                const db = client.db(dbName);
                const collection_mongo = db.collection(collection);
                const findResult = await collection_mongo.findOne({
                    "_id": id
                });
                res.status(200).json( findResult )
                // console.log(findResult)
                await client.close();
                // console.log("disconnect")

            }
        catch(e){
            console.log(e)
            res.status(500).json({message: "Такой базы или коллекции не существует, проверьте url и port, пример url=127.0.0.1, port = 27017"})
        }
      })
    
    app.post('/find_all',   
      async (req, res) => {
      try {
            console.log('post /find_all')
            console.log('Body', req.body)
            const {dbName, collection} = req.body
            console.log(url_mongo)
            const client = new MongoClient(url_mongo);
            await client.connect()
            // console.log("connect")
            const db = client.db(dbName);
            const collection_mongo = db.collection(collection);
            const findResult = await collection_mongo.find({}).toArray();
            res.status(200).json( findResult )
            // console.log(findResult)
            await client.close();
            // console.log("disconnect")

        }
        catch(e){
            console.log(e)
            res.status(500).json({message: "Такой базы или коллекции не существует, проверьте url и port, пример url=127.0.0.1, port = 27017"})
        }
    })
    app.post('/db/:dbName/search_by_script', javascript_parser,  
      async (req, res) => {
      try {
            console.log('post /search_by_script')
            console.log('Body', req.body)
            const dbName = "iot-" + req.params["dbName"];
            const script = req.body
            const client = new MongoClient(url_mongo);
            await client.connect()
            // console.log("connect")
            const db = client.db(dbName);
            const findResult = await eval(script)
            res.status(200).json(findResult)
            // console.log(findResult)
            await client.close();
            // console.log("disconnect")
        }
        catch(e){
            console.log(e)
            res.status(500).json({message: "Такой базы или коллекции не существует, проверьте url и port, пример url=127.0.0.1, port = 27017"})
        }
    })

const startProxy = function () {
    server = app.listen(port_express, () => {
        console.log(`Postman Mongo proxy is listening on port ${port_express}`)
    })
}

const stopProxy = function () {
    server?.close();
}

function isScript() {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isScript()) {
    startProxy();
}

export default {
    startProxy,
    stopProxy
}
