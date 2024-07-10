import fs from 'fs-extra'
import express from 'express'
import ZWaveController from './controller.js';
import O7CtlInterface from './interfaces/o7/o7_interface.js';
import GlcpCtlInterface from './interfaces/glcp/glcp_interface.js';
import sanitize from 'sanitize-filename';
import Utils from './utils.js';
import ICtlInterface from './interfaces/ctl_interface.js';
import ZWaveDevice, { ProbeType } from './device.js';
import util from 'util';
import { pathToFileURL } from 'url'

const pkg = fs.readJSONSync("package.json");
const app = express();
app.use(express.json());

let serverInstance = null;

declare global {
  var config: any;
}

globalThis.config = {
  port: 4455,
  quiet: false
}

let ctl = new ZWaveController();

ctl.mac = "ff:ff:ff:ff:ff:fa";
ctl.serial = "ZWS0000000";
ctl.version = pkg.version;
ctl.model = "Z-Wave Simulator";

app.get('/ctl/info', (req, res) => {
  sendJson(res, ctl);
})

app.post('/ctl/info', (req, res) => {
  if (ctl._interfaces.length > 0)
    res.status(400).send(`Unable to change controller info while connected`)
  else {
    ctl.fillFromJSON(req.body);
    sendJson(res, ctl);
  }
})

app.post('/ctl/connect', async (req, res) => {
  let host = req.body.host;
  let port = req.body.port;
  let type = req.body.type;
  let allowMultiple = req.body.allowMultiple;

  let iface = null;

  switch (type) {
    case "o7": iface = new O7CtlInterface(); break;
    case "glcp": iface = new GlcpCtlInterface(); break;
  }

  if (iface == null) {
    res.status(400).send(`Unknown protocol type "${type}"`)
    return;
  }

  if (!allowMultiple) {
    for (let currentIface of ctl._interfaces) {
      ctl.removeInterface(currentIface);
    }
  }

  ctl.addInterface(iface);
  let result = await iface.connect(host, port);

  if (result)
    sendJson(res, ctl);
  else {
    res.status(500).send(`Failed to connect to ${type}://${host}:${port}`);
    ctl.removeInterface(iface)
  }
})

app.post('/ctl/disconnect', (req, res) => {
  let host = req.body.host;
  let port = Number(req.body.por);
  let type = req.body.type;

  let ifaceType = null;

  switch (type) {
    case "o7": ifaceType = O7CtlInterface; break;
    case "glcp": ifaceType = GlcpCtlInterface; break;
  }

  if (type && !ifaceType) {
    res.status(400).send(`Unknown protocol type "${type}"`)
    return;
  }

  let iface = ctl._interfaces.find(x => (!ifaceType || x.constructor.name == ifaceType.name) &&
    (!host || x.getHost() == host) &&
    (!port || x.getPort() == port))

  if (!iface) {
    res.status(404).send(`Connection ${type}://${host}:${port} not found`)
    return;
  }

  ctl.removeInterface(iface)
  sendJson(res, ctl);
})

app.post('/devices/add', async (req, res) => {
  let template = req.body.template;
  let device = null;

  if (template) {
    try {
      let klass = await import(`./devices/${sanitize(template)}.js`);
      device = new klass.default();
    } catch (ex) {
      res.status(400).send(`Device template with name "${device.nodeId}" not found`);
      return;
    }
  }
  else
    device = new ZWaveDevice();

  if (!device) {
    res.status(500).send(`Unable to create device`);
    return;
  }

  delete req.body.template;
  device.fillFromJSON(req.body);

  if (ctl.devices.some(x => x.nodeId == device.nodeId)) {
    res.status(400).send(`Device with node ID "${device.nodeId}" already exists`);
    return;
  }

  ctl.addDevice(device);
  sendJson(res, device);
})

app.delete('/devices/:nodeId', async (req, res) => {
  let nodeId = Number(req.params.nodeId);

  let device = ctl.devices.find(x => x.nodeId == nodeId);

  if (device) {
    ctl.removeDevice(device);
    res.sendStatus(204)
    return;
  }
  else {
    res.status(404).send(`Device with node ID "${nodeId}" not found`)
    return;
  }
})

app.post('/devices/:nodeId/prop/:endpoint/:model', async (req, res) => {
  let nodeId = Number(req.params.nodeId);
  let endpoint = req.params.endpoint;
  let probeType = <ProbeType>req.params.model;
  let value = req.body.value;
  let rule = req.body.rule;


  let device = ctl.devices.find(x => x.nodeId == nodeId);
  let prop = device?.getProperty(endpoint, probeType);

  if (device) {
    if (!prop) {
      res.status(404).send(`Property with endpoint "${endpoint}" and model "${probeType}" not found`)
      return;
    }

    device._actions = device._actions.filter(x => x.property != prop);
    if (rule) {
      device._actions.push({
        property: prop,
        ruleRegExp: new RegExp(rule),
        action: () => prop.Value = value
      });
    }
    else
      prop.Value = value;

    sendJson(res, prop);
    return;
  }
  else {
    res.status(404).send(`Device with node ID "${nodeId}" not found`)
    return;
  }
})

app.post('/devices/:nodeId/prop', async (req, res) => {
  let nodeId = Number(req.params.nodeId);
  let device = ctl.devices.find(x => x.nodeId == nodeId);
  if (device) {
    device.silent = true;    
    for (let endpoint in req.body) {
      for (let probeType in req.body[endpoint]) {

        let value = req.body[endpoint][probeType].value;
        let rule = req.body[endpoint][probeType].rule;

        let prop = device?.getProperty(endpoint, <ProbeType>probeType);

        if (!prop) {
          console.warn(`Property with endpoint "${endpoint}" and model "${probeType}" not found`);
          continue;
        }

        device._actions = device._actions.filter(x => x.property != prop);
        if (rule) {
          device._actions.push({
            property: prop,
            ruleRegExp: new RegExp(rule),
            action: () => prop.Value = value
          });
        }
        else
          prop.Value = value;

      }
    }

    //вызываем отправку полного состояния устройства
    device.silent = false;
    device.PoweredOn = true;

    sendJson(res, device);
  }
  else {
    res.status(404).send(`Device with node ID "${nodeId}" not found`)
  }

})

app.post('/devices/:nodeId/guard_mode', async (req, res) => {
  let nodeId = Number(req.params.nodeId);
  let value = Number(req.body.value);

  let device = ctl.devices.find(x => x.nodeId == nodeId);

  if (device) {
    device.setGuardMode(value);
    sendJson(res, device);
    return;
  }
  else {
    res.status(404).send(`Device with node ID "${nodeId}" not found`)
    return;
  }
})

app.post('/devices/:nodeId/keep_alive', async (req, res) => {
  let nodeId = Number(req.params.nodeId);
  let value = Number(req.body.value);

  let device = ctl.devices.find(x => x.nodeId == nodeId);

  if (device) {
    device.KeepAlivePeriod = value;
    sendJson(res, device);
    return;
  }
  else {
    res.status(404).send(`Device with node ID "${nodeId}" not found`)
    return;
  }
})

app.post('/devices/:nodeId/power', async (req, res) => {
  let nodeId = Number(req.params.nodeId);
  let value = Boolean(req.body.value);

  let device = ctl.devices.find(x => x.nodeId == nodeId);

  if (device) {
    device.PoweredOn = value;
    sendJson(res, device);
    return;
  }
  else {
    res.status(404).send(`Device with node ID "${nodeId}" not found`)
    return;
  }
})

app.patch('/devices/:nodeId', async (req, res) => {
  let nodeId = Number(req.params.nodeId);

  let device = ctl.devices.find(x => x.nodeId == nodeId);

  if (!device) {
    res.status(404).send(`device with node ID "${nodeId}" not found`);
    return;
  }

  device.fillFromJSON(req.body, true);
  sendJson(res, device);
})


const startCtl = function () {
  serverInstance = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`)
  })
}

const stopCtl = function () {
  serverInstance?.close();
}

function sendJson(res: any, obj: any): void {
  res.status(200)
    .contentType('application/json')
    .send(JSON.stringify(obj));
}

function isScript() {
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isScript()) {
  startCtl();
}

export default {
  config : globalThis.config,
  startCtl,
  stopCtl
}
