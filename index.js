'use strict'

const express = require('express');
const http = require('http');
const SerialPort = require('serialport');
const WebSocketServer = require('websocket').server;
const Readline = require('@serialport/parser-readline');
const fs = require('fs');
const exec = require('child_process').exec;
const lineReader = require('line-by-line');
const dgram = require('dgram');
const dgServer = dgram.createSocket('udp4');
const favicon = require('serve-favicon');
const { createCanvas, loadImage, Canvas } = require('canvas');

var wss;
var websocketPort = 9696; 
var httpPort = 8080; 
var serialPort = "";
var baudrate = 0;
var vne = 0;
var vno = 0;
var vs1 = 0;
var vs0 = 0;
var stW = 85;
var stH = 1844;
var debug = false;
var speedStyle = "KT";
var firstrun = false;
var inPlayback = false;
var stopPlayback = false;
var tapeimage;
var view = "";
var ahrs = "";
var trafficWarnings = false;
var stratuxAHRS = false;
var stratuxIPaddress = "192.168.10.1"; // default, overwritten if different in setup
var maxWarnAltitude = 0;
var maxWarnDistance = 0;

var setupview = __dirname + "/public/setup.html";
var vufineview = __dirname + "/public/viewfine.html";
var indexview = __dirname + "/public/index.html";

var cvs = createCanvas(stW, stH);
var ctx = cvs.getContext('2d');


readSettingsFile();

// if we're going to receive Stratux traffic data...
if (trafficWarnings) {
    dgServer.on('error', (err) => {
        console.log(`server error:\n${err.stack}`);
        server.close();
    });
      
    dgServer.on('message', (msg, rinfo) => {
        //var strmsg = new TextDecoder("utf-8").decode(msg);
        //console.log(strmsg);
    });
      
    dgServer.on('listening', () => {
        var address = server.address();
        console.log("Stratux traffic heartbeat listener enabled");
    });
    
    dgServer.bind(4000);
}

// http websocket server to forward serial data to browser client
var server = http.createServer(function (request, response) { });
try {
    server.listen(websocketPort, function () { });
    // create the server
    wss = new WebSocketServer({
        httpServer: server
    });
    console.log("Serial data forwarding server enabled at port " + websocketPort); 
}
catch (error) {
    console.log(error);
}

var connection;
try {
    wss.on('request', function (request) {
        connection = request.accept(null, request.origin);
        console.log("new connection");
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
        var dataline = String(line);
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

// express web server  
var app = express();
try {
        app.use(express.urlencoded({ extended: true }));
        app.listen(httpPort, () => {
        console.log("Webserver listening at port " + httpPort);
    });
    
    var options = {
        dotfiles: 'ignore',
        etag: false,
        extensions: ['html'],
        index: false,
        redirect: false,
        setHeaders: function (res, path, stat) {
          res.set('x-timestamp', Date.now());
        }
    };

    app.use(express.static("public", options));
    app.use(favicon(__dirname + '/public/img/favicon.png'));
    
    app.get('/',(req, res) => {
        if (firstrun) {
            generateSetupView();
            res.sendFile(setupview);
        }
        else {
            generateHudView();
            if (view == "VuFine") {
                res.sendFile(vufineview);
            }
            else {
                res.sendFile(indexview);
            }

        }
    });

    app.get("/setup", (req,res) => {
        generateSetupView();
        res.sendFile(setupview);           
    });

    app.get("/shutdown", (req,res) => {
        systemShutdown(function(output){
            console.log(output);
        });
    });    
    
    app.get("/reboot", (req,res) => {
        systemReboot(function(output){
            console.log(output);
        });
    });    

    app.get("/stratux", (req,res) => {
        res.redirect("http://" + stratuxIPaddress);
    });

    app.post("/setup", (req, res) => {
        var newserialport = req.body.serialPort;
        var newbaudrate =  parseInt(req.body.baudrate);
        var newdebug = req.body.dbgchecked == "true" ? true : false;
        var newvne = parseInt(req.body.vne);
        var newvno = parseInt(req.body.vno);
        var newvs1 = parseInt(req.body.vs1);
        var newvs0 = parseInt(req.body.vs0);
        var writefile = false;
        var reopenport = false;
        var reboot = false;
        var newview = req.body.view;
        var newtw = req.body.twchecked == "true" ? true : false;
        var newmaxwarnalt = Number(req.body.maxwarnaltitude);
        var newmaxwarndist = Number(req.body.maxwarndistance);
        var newspeedstyle = req.body.speedstyle;  
        var newahrs = req.body.ahrs;
        var newstxipaddr = req.body.stxipaddr;
        
        firstrun = false;

        if (newahrs != ahrs) {
            ahrs = newahrs;
            stratuxAHRS = (ahrs == "Stratux");
            writefile = true;
        }
        
        if (newstxipaddr != stratuxIPaddress) {
            stratuxIPaddress = newstxipaddr;
            writefile = true;
        }

        if (newspeedstyle != speedStyle) {
            speedStyle = newspeedstyle;
            writefile = true;
        }
        
        if (newview != view) {
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
        
        if (debug && !newdebug) {
            stopPlayback = true;
            debug = false;
            writefile = true;
        }
        else if (!debug && newdebug) {
            debug = true;
            writefile = true;
        }

        if ((newmaxwarnalt != maxWarnAltitude) || (newmaxwarndist != maxWarnDistance)) {
            maxWarnAltitude = newmaxwarnalt;
            maxWarnDistance = newmaxwarndist;
            writefile = true;
        }

        if (trafficWarnings && !newtw) {
            trafficWarnings = false;
            writefile = true;
        }
        else if (!trafficWarnings && newtw) {
            trafficWarnings = true;
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
            var data = { "view" : view, 
                         "httpPort" : httpPort,
                         "wsPort" : websocketPort,
                         "serialPort" : serialPort,
                         "baudrate" : baudrate, 
                         "vne" : vne,
                         "vno" : vno,
                         "vs1" : vs1,
                         "vs0" : vs0,
                         "trafficwarnings" : trafficWarnings,
                         "maxwarnaltitude" : maxWarnAltitude,
                         "maxwarndistance" : maxWarnDistance,
                         "speedstyle" : speedStyle,
                         "ahrs" : ahrs,
                         "stratuxipaddress" : stratuxIPaddress,
                         "debug" : debug,
                         "firstrun" : firstrun
                        };
            var stringToWrite = JSON.stringify(data, null, '  ').replace(/: "(?:[^"]+|\\")*",?$/gm, ' $&');
            fs.writeFileSync(__dirname + "/settings.json", stringToWrite,{flag: 'w+'});

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
        
        generateSetupView();
        buildSpeedTapeImage(tapeimage);
        
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

if (!stratuxAHRS) {
    openSerialPort(false);
}

var connections = new Array(4);
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
    var parsedData = JSON.parse(rawdata);
    view = parsedData.view;
    serialPort = parsedData.serialPort;
    var hport = parsedData.httpPort;
    var wsPort = parsedData.wsPort;
    baudrate = parseInt(parsedData.baudrate);
    vne = parsedData.vne;
    vno = parsedData.vno;
    vs1 = parsedData.vs1;
    vs0 = parsedData.vs0;
    trafficWarnings = parsedData.trafficwarnings;
    maxWarnAltitude = Number(parsedData.maxwarnaltitude);
    maxWarnDistance = Number(parsedData.maxwarndistance);
    speedStyle = parsedData.speedstyle;
    ahrs = parsedData.ahrs;
    stratuxAHRS = (ahrs == "Stratux");
    stratuxIPaddress = parsedData.stratuxipaddress;
    debug = parsedData.debug;
    firstrun = parsedData.firstrun;
    
    if (httpPort != hport) {
        httpPort = hport;
    }

    if (websocketPort != wsPort) {
        websocketPort = wsPort;
    }
}

// ------------------------ Serial event functions:
function showPortOpen() {
    console.log("serial port opened at " + port.path + " baud rate: " + port.baudRate);
}

function sendDataToBrowser(data) {
    connections.forEach(function(connection) {
        connection.send(data); 
    });
}

function showPortClose() {
    console.log('port closed.');
}
// this is called when the serial port has an error:
function showError(error) {
    console.log('Serial port error: ' + error);
}

function generateVuFineView() {
    var regex0 = /##VNE##/gi;
    var regex1 = /##VNO##/gi;
    var regex2 = /##VS1##/gi;
    var regex3 = /##VS0##/gi;
    var regex4 = /##WSPORT##/gi;
    var rawdata = String(fs.readFileSync(__dirname + "/templates/vufine_template.html"));
    var output = rawdata.replace(regex0, vne)
                        .replace(regex1, vno)
                        .replace(regex2, vs1)
                        .replace(regex3, vs0)
                        .replace(regex4, websocketPort);
    fs.writeFileSync(vufineview, output);
}

function generateHudView() {
    if (view.toLowerCase() == "vufine") {
        generateVuFineView();
    }
    else {
        generateHudStylesheet();
        var regex0 = /##WSPORT##/gi;
        var regex1 = /##TRAFFICWARN##/gi;
        var regex2 = /##MAXWARNALT##/gi;
        var regex3 = /##MAXWARNDIST##/gi;
        var regex4 = /##SPEEDSTYLE##/gi;
        var regex5 = /##AHRS##/gi;
        var regex6 = /##STXIPADDR##/gi;
        
        
        var rawdata = String(fs.readFileSync(__dirname + "/templates/index_template.html"));
        var output = rawdata.replace(regex0, websocketPort)
                            .replace(regex1, trafficWarnings)
                            .replace(regex2, maxWarnAltitude)
                            .replace(regex3, maxWarnDistance)
                            .replace(regex4, speedStyle)
                            .replace(regex5, ahrs)
                            .replace(regex6, stratuxIPaddress);

        fs.writeFileSync(indexview, output);
    }
}

function generateHudStylesheet() {
    var lcview = view.toLowerCase();
    if (lcview != "vufine") {
        var output = String(fs.readFileSync(__dirname + "/templates/" + lcview + "_template.css"));
        fs.writeFileSync(__dirname + "/public/css/classes.css", output);
    }
}

function generateSetupView(port) {
    var regex00 = /##VIEW##/gi;
    var regex01 = /##TWVALUE##/gi;
    var regex02 = /##TWCHECKED##/gi;
    var regex03 = /##SERIALPORT##/gi;
    var regex04 = /##BAUDRATE##/gi;
    var regex05 = /##DBGVALUE##/gi;
    var regex06 = /##DBGCHECKED##/gi;
    var regex07 = /##VNE##/gi;
    var regex08 = /##VNO##/gi;
    var regex09 = /##VS1##/gi;
    var regex10 = /##VS0##/gi;
    var regex11 = /##MAXWARNALT##/gi;
    var regex12 = /##MAXWARNDIST##/gi;
    var regex13 = /##SPEEDSTYLE##/gi;
    var regex14 = /##AHRS##/gi;
    var regex15 = /##STXIPADDR##/gi;
    
    var dbg = debug ? "true" : "false";
    var dbgchecked = debug ? "checked" : "";
    var tw = trafficWarnings ? "true" : "false";
    var twchecked = trafficWarnings ? "checked" : "";
    
    var rawdata = String(fs.readFileSync(__dirname + "/templates/setup_template.html"));
    var output = rawdata.replace(regex00, view)
                        .replace(regex01, tw)
                        .replace(regex02, twchecked)
                        .replace(regex03, serialPort)
                        .replace(regex04, baudrate)
                        .replace(regex05, dbg)
                        .replace(regex06, dbgchecked)
                        .replace(regex07, vne)
                        .replace(regex08, vno)
                        .replace(regex09, vs1)
                        .replace(regex10, vs0)
                        .replace(regex11, maxWarnAltitude)
                        .replace(regex12, maxWarnDistance)
                        .replace(regex13, speedStyle)
                        .replace(regex14, ahrs)
                        .replace(regex15, stratuxIPaddress);
    fs.writeFileSync(setupview, output);
}

loadImage(__dirname + "/templates/speed_tape_template.png").then(image => { 
    buildSpeedTapeImage(image);
});

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

    var buffer = cvs.toBuffer('image/png');
    fs.writeFileSync(__dirname + "/public/img/speed_tape.png", buffer);
}
