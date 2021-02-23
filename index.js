'use strict'

const express = require('express');
const http = require('http');
const SerialPort = require('serialport');
const WebSocketServer = require('websocket').server;
const Readline = require('@serialport/parser-readline');
const fs = require('fs');
const exec = require('child_process').exec;
const lineReader = require('line-by-line');
const dgram = require('dgram')
const dgServer = dgram.createSocket('udp4');
const { createCanvas, loadImage, Canvas } = require('canvas');

dgServer.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});
  
dgServer.on('message', (msg, rinfo) => {
    console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
});
  
dgServer.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

dgServer.bind(4000);

var wss;
var websocketPort = 9696; 
var httpPort = 8686; 
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
var trafficWarnings = false;
var stratuxAHRS = false;
var maxWarnAltitude = 0;
var maxWarnDistance = 0;

const setupview = __dirname + "/setup.html";
const vufineview = __dirname + "/public/viewfine.html";
const indexview = __dirname + "/public/index.html";

const cvs = createCanvas(stW, stH);
const ctx = cvs.getContext('2d');


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
            generateSetupView();
            res.sendFile(setupview);
        }
        else {
            generateHudView();
            if (view == "vufine") {
                res.sendFile(vufineview);
            }
            else {
                res.sendFile(indexview);
            }

        }
    });

    webserver.get("/setup", (req,res) => {
        generateSetupView();
        res.sendFile(setupview);           
    });

    webserver.get("/shutdown", (req,res) => {
        systemShutdown(function(output){
            console.log(output);
        });
    });    
    
    webserver.get("/reboot", (req,res) => {
        systemReboot(function(output){
            console.log(output);
        });
    });    

    webserver.post("/setup", (req, res) => {
        console.log(req.body);
        let viewProperName = req.body.selectedview;
        let newserialport = req.body.serialPort;
        let newbaudrate =  parseInt(req.body.baudrate);
        let newdebug = req.body.debugchecked == "true" ? true : false;
        let newvne = parseInt(req.body.vne);
        let newvno = parseInt(req.body.vno);
        let newvs1 = parseInt(req.body.vs1);
        let newvs0 = parseInt(req.body.vs0);
        let writefile = false;
        let reopenport = false;
        let reboot = false;
        var newview = String(viewProperName).toLowerCase();
        let newtw = req.body.twchecked == "true" ? true : false;
        let newmaxwarnalt = req.body.maxwarnaltitude;
        let newmaxwarndist = req.body.maxwarndistance;
        let newspeedstyle = req.body.speedstyle;  
        let newstxahrs = req.body.stxchecked = "true" ? true : false;
        
        firstrun = false;

        if (newstxahrs != stratuxAHRS) {
            stratuxAHRS = newstxahrs;
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

        if ((newmaxwarnalt != maxWarnAltitude) || (newmaxwarndist != newmaxwarndist)) {
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
            let data = { "view" : viewProperName, 
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
                         "stratuxahrs" : stratuxAHRS,
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
    var parsedData = JSON.parse(rawdata);
    view = String(parsedData.view).toLowerCase();
    serialPort = parsedData.serialPort;
    var hport = parsedData.httpPort;
    var wsPort = parsedData.wsPort;
    baudrate = parseInt(parsedData.baudrate);
    vne = parsedData.vne;
    vno = parsedData.vno;
    vs1 = parsedData.vs1;
    vs0 = parsedData.vs0;
    trafficWarnings = parsedData.trafficwarnings;
    maxWarnAltitude = parsedData.maxwarnaltitude;
    maxWarnDistance = parsedData.maxwarndistance;
    speedStyle = parsedData.speedstyle;
    stratuxAHRS = parsedData.stratuxahrs;
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

function generateVuFineView() {
    const regex0 = /##VNE##/gi;
    const regex1 = /##VNO##/gi;
    const regex2 = /##VS1##/gi;
    const regex3 = /##VS0##/gi;
    const regex4 = /##WSPORT##/gi;
    var rawdata = String(fs.readFileSync(__dirname + "/templates/vufine_template.html"));
    var output = rawdata.replace(regex0, vne)
                        .replace(regex1, vno)
                        .replace(regex2, vs1)
                        .replace(regex3, vs0)
                        .replace(regex4, websocketPort);
    fs.writeFileSync(vufineview, output);
}

function generateHudView() {
    if (view == "vufine") {
        generateVuFineView();
    }
    else {
        generateHudStylesheet();

        const regex0 = /##WSPORT##/gi;
        const regex1 = /##TRAFFIC_WARN##/gi;
        const regex2 = /##MAX_WARN_ALTITUDE##/gi;
        const regex3 = /##MAX_WARN_DISTANCE##/gi;
        const regex4 = /##SPEEDSTYLE##/gi;
        const regex5 = /##STXAHRS##/gi;

        var rawdata = String(fs.readFileSync(__dirname + "/templates/index_template.html"));
        var output = rawdata.replace(regex0, websocketPort)
                            .replace(regex1, trafficWarnings)
                            .replace(regex2, maxWarnAltitude)
                            .replace(regex3, maxWarnDistance)
                            .replace(regex4, speedStyle)
                            .replace(regex5, stratuxAHRS);

        fs.writeFileSync(indexview, output);
    }
}

function generateHudStylesheet() {
    var output = String(fs.readFileSync(__dirname + "/templates/" + view + "_template.css"));
    fs.writeFileSync(__dirname + "/public/css/classes.css", output);
}

function generateSetupView(port) {
    const regex00 = /##VIEW##/gi;
    const regex01 = /##TWVALUE##/gi;
    const regex02 = /##TWCHECKED##/gi;
    const regex03 = /##SERIALPORT##/gi;
    const regex04 = /##BAUDRATE##/gi;
    const regex05 = /##DEBUGVALUE##/gi;
    const regex06 = /##DBGCHECKED##/gi;
    const regex07 = /##VNE##/gi;
    const regex08 = /##VNO##/gi;
    const regex09 = /##VS1##/gi;
    const regex10 = /##VS0##/gi;
    const regex11 = /##MAX_WARN_ALTITUDE##/gi;
    const regex12 = /##MAX_WARN_DISTANCE##/gi;
    const regex13 = /##SPEEDSTYLE##/gi;
    const regex14 = /##STXVALUE##/gi;
    const regex15 = /##STXCHECKED##/gi;

    var properViewName;
    var dbg = debug ? "true" : "false";
    var checked = debug ? "checked" : "";
    var tw = trafficWarnings ? "true" : "false";
    var twchecked = trafficWarnings ? "checked" : "";
    var stx = stratuxAHRS ? "true" : "false";
    var stxchecked = stratuxAHRS ? "checked" : "";

    switch (view) {
       case "vufine":
           properViewName = "VuFine";
           break;
       case "kivic" :
           properViewName = "Kivic";
           break;
       default : 
           properViewName = "Hudly";
    }

    var rawdata = String(fs.readFileSync(__dirname + "/templates/setup_template.html"));
    var output = rawdata.replace(regex00, properViewName)
                        .replace(regex01, tw)
                        .replace(regex02, twchecked)
                        .replace(regex03, serialPort)
                        .replace(regex04, baudrate)
                        .replace(regex05, dbg)
                        .replace(regex06, checked)
                        .replace(regex07, vne)
                        .replace(regex08, vno)
                        .replace(regex09, vs1)
                        .replace(regex10, vs0)
                        .replace(regex11, maxWarnAltitude)
                        .replace(regex12, maxWarnDistance)
                        .replace(regex13, speedStyle)
                        .replace(regex14, stx)
                        .replace(regex15, stxchecked);
    fs.writeFileSync(setupview, output);
}

loadImage(__dirname + "/templates/speed_tape_template.png").then(image => { 
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

