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
const { createCanvas, loadImage, Canvas } = require('canvas');

var wss;
var websocketPort = 9696; 
var httpPort = 8686; 
var serialPort;
var baudrate;
var view;
var vne;
var vno;
var vs1;
var vs0;
var stW = 85;
var stH = 1844;
var debug = false;
var firstrun = false;
var inPlayback = false;
var stopPlayback = false;
var tapeimage;
var currentview;
var stylesheet;

const setupview = __dirname + "/setup.html";
const vufineview = __dirname + "/public/viewfine.html";
const indexview = __dirname + "/public/index.html";

const cvs = createCanvas(stW, stH);
const ctx = cvs.getContext('2d');

readSettingsFile(); // this also generates the setup.html and vufine.html views

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
        
        if (stopPlayback) {
            inPlayback = false;
            stopPlayback = false;
            lr.close();
            return;
        }

        // pause emitting of lines...
        lr.pause();

        // ...do asynchronous line processing..
        var dataline = new String(line);
        if (line.substr(0, 1) == "!") {
            sendDataToBrowser("!" + dataline.substr(1));
        }
        
        setTimeout(function () {
            lr.resume();
        }, 150);
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
    
    const options = {
        dotfiles: 'ignore',
        etag: false,
        extensions: ['html'],
        index: false,
        redirect: false,
        setHeaders: function (res, path, stat) {
          res.set('x-timestamp', Date.now())
        }
    };
    
    webserver.use(express.static("public", options));
    
    webserver.get('/',(req, res) => {
        if (firstrun) {
            res.sendFile(setupview);
        }
        else {
            res.sendFile(currentview);
        }
    });

    webserver.get("/setup", (req,res) => {
        res.sendFile(setupview);           
    });

    webserver.get("/shutdown", (req,res) => {
        systemShutdown(function(output){
            console.log(output);
        });
    });    
    
    webserver.post("/setup", (req, res) => {
        console.log(req.body);
        let newview = req.body.selectedview;
        let newserialport = req.body.serialPort;
        let newbaudrate =  parseInt(req.body.baudrate);
        let newdebug = req.body.debugchecked;
        let newvne = parseInt(req.body.vne);
        let newvno = parseInt(req.body.vno);
        let newvs1 = parseInt(req.body.vs1);
        let newvs0 = parseInt(req.body.vs0);
        let writefile = false;
        let reopenport = false;
        let reboot = false;
        
        if (newview != view) {
            stylesheet = String(newview).toLowerCase();
            switch(newview) {
                case "VuFine" :
                    currentview = vufineview;
                    generateVuFineView();
                    break;
                default:
                    currentview = indexview;
                    generateIndexView();
            };
            view = newview;
            writefile = true;
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
        
        if (debug && newdebug == "false") {
            stopPlayback = true;
            debug = false;
            writefile = true;
        }
        else if (!debug && newdebug == "true") {
            debug = true;
            writefile = true;
        }

        if (newvne != vne || newvno != vno || newvs1 != vs1 || newvs0 != vs0) {
            vne = newvne;
            vno = newvno;
            vs1 = newvs1;
            vs0 = newvs0;
            writefile = true;
        }

        if (writefile) {
            let data = { "view" : view, 
                         "httpPort" : httpPort,
                         "wsPort" : websocketPort,
                         "serialPort" : serialPort, 
                         "baudrate" : baudrate, 
                         "vne" : vne,
                         "vno" : vno,
                         "vs1" : vs1,
                         "vs0" : vs0,
                         "debug" : debug,
                         "firstrun" : false
                        };
            fs.writeFileSync(__dirname + "/settings.json", JSON.stringify(data),{flag: 'w+'});
            
            if (reboot) {
                systemReboot(function(output){
                    console.log(output);
                });
                res.end();
                return;
            }
        }

        if (reopenport) {
            openSerialPort(true);
        }
        
        buildSpeedTapeImage(tapeimage);
        generateSetupView();
        
        res.redirect("/");
    });
}
catch (error) {
    console.log(error);
}

function systemReboot(callback){
    exec('shutdown -r now', function(error, stdout, stderr){ callback(stdout); });
}
function systemShutdown(callback){
    exec('shutdown -h now', function(error, stdout, stderr){ callback(stdout); });
}

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
    view = JSON.parse(rawdata).view;
    serialPort = JSON.parse(rawdata).serialPort;
    var hport = JSON.parse(rawdata).httpPort;
    var wsPort = JSON.parse(rawdata).wsPort;
    baudrate = parseInt(JSON.parse(rawdata).baudrate);
    vne = JSON.parse(rawdata).vne;
    vno = JSON.parse(rawdata).vno;
    vs1 = JSON.parse(rawdata).vs1;
    vs0 = JSON.parse(rawdata).vs0;
    debug = JSON.parse(rawdata).debug;
    firstrun = JSON.parse(rawdata).firstrun;
    
    if (httpPort != hport) {
        httpPort = hport;
    }

    if (websocketPort != wsPort) {
        websocketPort = wsPort;
    }

    generateSetupView();
    
    switch (view) {
        case "VuFine":
            generateVuFineView(wsPort);
            currentview = vufineview;
            stylesheet = "vufine";
            break;
        case "Kivic":
            stylesheet = "kivic";
        case "Hudly":
            stylesheet = "hudly";
        default:
            generateHudStylesheet(stylesheet);
            generateIndexView(wsPort);
            currentview = indexview;

    }
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

function generateHudStylesheet(sourcename) {
    var output = String(fs.readFileSync(__dirname + "/public/templates/" + sourcename + "_template.css"));
    fs.writeFileSync(__dirname + "/public/css/classes.css", output);
}

function generateVuFineView() {
    const regex0 = /##VNE##/gi;
    const regex1 = /##VNO##/gi;
    const regex2 = /##VS1##/gi;
    const regex3 = /##VS0##/gi;
    const regex4 = /##WSPORT##/gi;
    var rawdata = String(fs.readFileSync(__dirname + "/public/templates/vufine_template.html"));
    var output = rawdata.replace(regex0, vne)
                        .replace(regex1, vno)
                        .replace(regex2, vs1)
                        .replace(regex3, vs0)
                        .replace(regex4, websocketPort);
    fs.writeFileSync(vufineview, output);
}

function generateIndexView() {
    const regex0 = /##WSPORT##/gi;
    var rawdata = String(fs.readFileSync(__dirname + "/public/templates/index_template.html"));
    var output = rawdata.replace(regex0, websocketPort);
    fs.writeFileSync(indexview, output);
}

function generateSetupView(port) {
    const regex0 = /##VIEW##/gi;
    const regex1 = /##SERIALPORT##/gi;
    const regex2 = /##BAUDRATE##/gi;
    const regex3 = /##DEBUGVALUE##/gi;
    const regex4 = /##CHECKED##/gi;
    const regex5 = /##VNE##/gi;
    const regex6 = /##VNO##/gi;
    const regex7 = /##VS1##/gi;
    const regex8 = /##VS0##/gi;
    
    var dbg = debug ? "true" : "false";
    var checked = debug ? "checked" : "";
    
    var rawdata = String(fs.readFileSync(__dirname + "/public/templates/setup_template.html"));
    var output = rawdata.replace(regex0, view)
                        .replace(regex1, serialPort)
                        .replace(regex2, baudrate)
                        .replace(regex3, dbg)
                        .replace(regex4, checked)
                        .replace(regex5, vne)
                        .replace(regex6, vno)
                        .replace(regex7, vs1)
                        .replace(regex8, vs0)
    fs.writeFileSync(setupview, output);
}

loadImage(__dirname + "/public/templates/speed_tape_template.png").then(image => { 
    buildSpeedTapeImage(image);
})

function buildSpeedTapeImage(image) {
    
    tapeimage = image;
    
    var mphfactor = 4.796875;  // = image height divided by 320 mph

    var maxSpeed = 320;
    var redTop = 45;
    var redHeight = 1536;

    var yellowTop = redTop + ((maxSpeed - vne) * mphfactor);
    var yellowHeight = (vne - vno) * mphfactor;

    var greenTop = yellowTop + yellowHeight;
    var greenHeight = (vno - vs1) * mphfactor;
    
    var whiteTop = greenTop + greenHeight;
    var whiteHeight = (vs1 - vs0) * mphfactor;

    ctx.drawImage(image, 0, 0, stW, stH);
    ctx.fillStyle = "red";
    ctx.fillRect(71, redTop, 9.5, redHeight);

    ctx.fillStyle = "white";
    ctx.fillRect(71, whiteTop, 9.5, whiteHeight);

    ctx.fillStyle = "#2dff00";
    ctx.fillRect(71, greenTop, 9.5, greenHeight);

    ctx.fillStyle = "yellow";
    ctx.fillRect(71, yellowTop, 9.5, yellowHeight);

    const buffer = cvs.toBuffer('image/png')
    fs.writeFileSync(__dirname + "/public/img/speed_tape.png", buffer);
}

