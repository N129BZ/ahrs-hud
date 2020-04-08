
const express = require('express');
const http = require('http');
const SerialPort = require('serialport');
const WebSocketServer = require('websocket').server;
const Readline = require('@serialport/parser-readline');
const fs = require('fs');

var websocketPort = 9696; 
var httpPort = 8686; 
var serialPort;

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
    webserver.use(express.urlencoded());

    webserver.listen(httpPort, () => {
        console.log("Webserver listening at port " + httpPort);
    });

    webserver.use(express.static(__dirname + "/public"));

    webserver.get("/", (req, res) => {
        res.sendFile(__dirname + "/public/index.html");
    });

    webserver.get("/config", (req,res) => {
        let chunk = buildConfigWebPage();
        res.write(chunk);           
    });

    webserver.post("/config", (req, res) => {
        var newport = req.body.portname;
        if (newport != serialPort)
        {
            let filename = __dirname + '/config.json';
            serialPort = newport;
            fs.unlinkSync(filename);
            let data = { "portname" : serialPort };
            fs.writeFileSync(filename, JSON.stringify(data),{flag: 'w+'});
            openSerialPort(true);
        }
        res.redirect('/'); 
        res.end();
    });
}
catch (error) {
    console.log(error);
}

openSerialPort(true);

var connections = new Array;
var port;
var parser;
function openSerialPort(needsFileRead) {
    try {

        if (needsFileRead) {
            let rawdata = fs.readFileSync(__dirname + '/config.json');
            serialPort = JSON.parse(rawdata).portname;
            needsFileRead = false;
        }

        port = new SerialPort(serialPort, { baudRate: 115200 });    // open the port
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

// ------------------------ Serial event functions:
// this is called when the serial port is opened:
function showPortOpen() {
    console.log("serial port opened at " + serialPort);
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

function handleConnection(client) {
    console.log("New Connection");
    connections.push(client);

    client.on('close', function () {
        console.log("connection closed");
        var position = connections.indexOf(client);
        connections.splice(position, 1);
    });
}

function buildConfigWebPage() {
    let rawdata = fs.readFileSync(__dirname + '/config.html');
    return String(rawdata).replace("##PORTNAME##", serialPort);
}