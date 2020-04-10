
const express = require('express');
const http = require('http');
const SerialPort = require('serialport');
const WebSocketServer = require('websocket').server;
const Readline = require('@serialport/parser-readline');
const fs = require('fs');

var websocketPort = 9696; 
var httpPort = 8686; 
var serialPort;
var speedtape;
var baudrate;

var server = http.createServer(function (request, response) { });
try {
    server.listen(websocketPort, function () { });
    // create the server
    wss = new WebSocketServer({
        httpServer: server
    });
    console.log("Websocket server listening at port " + websocketPort);
}
catch (error) {
    console.log(error);
}

var connection;
try {
    wss.on('request', function (request) {
        connection = request.accept(null, request.origin);
        console.log("New Connection");
        connections.push(connection);

        connection.on('close', function () {
            console.log("connection closed");
            var position = connections.indexOf(connection);
            connections.splice(position, 1);
        });
    });
}
catch (error) {
    console.log(error);
}

var webserver;
try {
    webserver = express();
    webserver.use(express.urlencoded({ extended: true }));
    webserver.listen(httpPort, () => {
        console.log("Webserver listening at port " + httpPort);
    });

    webserver.use(express.static(__dirname + "/public"));

    webserver.get("/", (req, res) => {
        res.sendFile(__dirname + "/public/index.html");
    });

    webserver.get("/config", (req,res) => {
        var chunk = buildConfigWebPage();
        res.write(chunk);           
    });

    webserver.post("/config", (req, res) => {
        console.log(req.body.params);
        let newport = req.body.portname;
        let newbaudrate =  parseInt(req.body.baudrate);
        let newspeedtape = req.body.selectedspeedtape;
        let writeconfig = false;
        let reopenport = false;

        if (newport != serialPort) {
            serialPort = newport;
            writeconfig = true;
            reopenport = true;
        }

        if (newbaudrate != baudrate) {
            baudrate = newbaudrate;
            writeconfig = true;
            reopenport = true;
        }

        if (newspeedtape != speedtape) {
            var workingtape = __dirname + "/public/img/speed_tape.png";
            var tapename = __dirname + "/public/img/speed_tapes/speed_tape_";
            fs.copyFileSync(tapename + newspeedtape + ".png", workingtape);
            speedtape = newspeedtape;
            writeconfig = true;
        }
        
        if (writeconfig) {
            let filename = __dirname + '/config.json';
            fs.unlinkSync(filename);
            let data = { "portname" : serialPort, "baudrate" : baudrate, "speedtape" : speedtape };
            fs.writeFileSync(filename, JSON.stringify(data),{flag: 'w+'});
        }

        if (reopenport) {
            openSerialPort(true);
        }
        
        res.redirect('/'); 
        res.end();
    });
}
catch (error) {
    console.log(error);
}

readConfigFile();
openSerialPort(false);

var connections = new Array;
var port;
var parser;
function openSerialPort(needsFileRead) {
    try {

        if (needsFileRead) {
            readConfigFile();
            needsFileRead = false;
        }

        port = new SerialPort(serialPort, { baudRate: baudrate });    // open the port
        parser = port.pipe(new Readline({ delimiter: '\n' }));

        port.on('open', showPortOpen);
        port.on('close', showPortClose);
        port.on('error', showError);
        parser.on('data', sendDataToBrowser);
    }
    catch (error) {
        console.log(error);
    }
}

function readConfigFile() {
    var rawdata = fs.readFileSync(__dirname + '/config.json');
    serialPort = JSON.parse(rawdata).portname;
    baudrate = parseInt(JSON.parse(rawdata).baudrate);
    speedtape = JSON.parse(rawdata).speedtape;
    
}

// ------------------------ Serial event functions:
// this is called when the serial port is opened:
function showPortOpen() {
    console.log("serial port opened at " + port.path + " baud rate: " + port.baudRate);
}

// this is called when new data comes into the serial port:
function sendDataToBrowser(data) {
    // if there are webSocket connections, send the serial data
    // console.log(data);
    for (c in connections) {     // iterate over the array of connections
        connections[c].send(data); // send the data to each connection
    }
}

function showPortClose() {
    console.log('port closed.');
}
// this is called when the serial port has an error:
function showError(error) {
    console.log('Serial port error: ' + error);
}

function handleConnection(client) {baudrate = JSON.parse(rawdata).baudrate;
    console.log("New Connection");
    connections.push(client);

    client.on('close', function () {
        console.log("connection closed");
        var position = connections.indexOf(client);
        connections.splice(position, 1);
    });
}

function buildConfigWebPage() {
    const regex1 = /##PORTNAME##/gi;
    const regex2 = /##BAUDRATE##/gi;
    const regex3 = /##SPEEDTAPE##/gi;
    var rawdata = String(fs.readFileSync(__dirname + '/config.html'));
    return rawdata.replace(regex1, serialPort)
                  .replace(regex2, baudrate)
                  .replace(regex3, speedtape);
}