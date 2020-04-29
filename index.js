'use strict'

const express = require('express');
const http = require('http');
const SerialPort = require('serialport');
const WebSocketServer = require('websocket').server;
const Readline = require('@serialport/parser-readline');
const fs = require('fs');
const exec = require('child_process').exec;
const protobuf = require("protobufjs");
const lineReader = require('line-by-line');

var wss;
var websocketPort = 9696; 
var httpPort = 8686; 
var serialPort;
var speedtape;
var baudrate;
var viewer;
var debug = false;
var inPlayback = false;

readSettingsFile();

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
        
        if (debug) {
            DebugPlayback();
        }

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

function DebugPlayback() {

    if (inPlayback) {
        return;
    }
    
    inPlayback = true;

    var lr = new lineReader(__dirname + "/adahrsdata.log");

    lr.on('error', function (err) {
        // 'err' contains error object
    });

    lr.on('line', function (line) {
        // pause emitting of lines...
        lr.pause();

        // ...do asynchronous line processing..
        var dataline = new String(line);
        if (line.substr(0, 1) == "!") {
            sendDataToBrowser("!" + dataline.substr(1));
        }
        
        setTimeout(function () {
            lr.resume();
        }, 100);
    });

    lr.on('end', function () {
        inPlayback = false;
    });
}

var webserver;
try {
    webserver = express();
    webserver.use(express.urlencoded({ extended: true }));
    webserver.listen(httpPort, () => {
        console.log("Webserver listening at port " + httpPort);
    });

    if (viewer == "VuFine") {
        webserver.use(express.static(__dirname + "/public", {index: "vufine.html"}));
    }
    else {
        webserver.use(express.static(__dirname + "/public", {index: "index.html"}));
    }

    webserver.get("/", (req, res) => {
        if (viewer == "VuFine") {
            res.sendFile(__dirname + "/public/vufine.html");
        }
        else {
            res.sendFile(__dirname + "/public/index.html");
        }
    });

    webserver.get("/setup", (req,res) => {
        var chunk = buildSettingsWebPage();
        res.write(chunk);           
    });

    webserver.get("/shutdown", (req,res) => {
        exec('sudo shutdown -h now', function (msg) { console.log(msg) });
    });    
    
    webserver.post("/setup", (req, res) => {
        console.log(req.body);
        let newviewer = req.body.selectedviewer;
        let newserialport = req.body.serialPort;
        let newbaudrate =  parseInt(req.body.baudrate);
        let newspeedtape = req.body.selectedspeedtape;
        let writefile = false;
        let reopenport = false;
        let reboot = false;

        if (newviewer != viewer) {
            viewer = newviewer;
            writefile = true;
            reboot = true;
        }

        if (newserialport != serialPort) {
            serialPort = newserialport;
            writefile = true;
            reopenport = true;
        }

        if (newbaudrate != baudrate) {
            baudrate = newbaudrate;
            writefile = true;
            reopenport = true;
        }

        if (newspeedtape != speedtape) {
            var workingtape = __dirname + "/public/img/speed_tape.png";
            var tapename = __dirname + "/public/img/speed_tapes/speed_tape_";
            fs.copyFileSync(tapename + newspeedtape + ".png", workingtape);
            speedtape = newspeedtape;
            writefile = true;
        }
        
        if (writefile) {
            let filename = __dirname + '/settings.json';
            fs.unlinkSync(filename);
            let data = { "viewer" : viewer, 
                         "serialPort" : serialPort, 
                         "baudrate" : baudrate, 
                         "speedtape" : speedtape,
                         "debug" : debug
                        };
            fs.writeFileSync(filename, JSON.stringify(data),{flag: 'w+'});

            if (reboot) {
                exec("sudo shutdown -r now", function (msg) { console.log(msg) });
                res.end();
                return;
            }
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

readSettingsFile();

openSerialPort(false);

var connections = new Array;
var port;
var parser;
function openSerialPort(needsFileRead) {
    try {

        if (needsFileRead) {
            readSettingsFile();
            needsFileRead = false;
        }

        port = new SerialPort(serialPort, { baudRate: baudrate });    
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

function readSettingsFile() {
    var rawdata = fs.readFileSync(__dirname + '/settings.json');
    viewer = JSON.parse(rawdata).viewer;
    serialPort = JSON.parse(rawdata).serialPort;
    baudrate = parseInt(JSON.parse(rawdata).baudrate);
    speedtape = JSON.parse(rawdata).speedtape;
    debug = JSON.parse(rawdata).debug;
}

// ------------------------ Serial event functions:
function showPortOpen() {
    console.log("serial port opened at " + port.path + " baud rate: " + port.baudRate);
}

function sendDataToBrowser(data) {
    connections.forEach(function(element) {
        element.send(data); 
    });
}

function showPortClose() {
    console.log('port closed.');
}
// this is called when the serial port has an error:
function showError(error) {
    console.log('Serial port error: ' + error);
}

function buildSettingsWebPage() {
    const regex1 = /##VIEWER##/gi;
    const regex2 = /##SERIALPORT##/gi;
    const regex3 = /##BAUDRATE##/gi;
    const regex4 = /##SPEEDTAPE##/gi;
    var rawdata = String(fs.readFileSync(__dirname + '/setup.html'));
    return rawdata.replace(regex1, viewer)
                  .replace(regex2, serialPort)
                  .replace(regex3, baudrate)
                  .replace(regex4, speedtape);
}
