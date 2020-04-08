
const express = require('express');
const http = require('http');
const SerialPort = require('serialport');
const WebSocketServer = require('websocket').server;
const Readline = require('@serialport/parser-readline');
const fs = require('fs');

var websocketPort = 9696; 
var httpPort = 8686; 
var serialPort;
var serialPortChanged = false;

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
        var filename = __dirname + '/hudconfig.json';
        if (newport != serialPort)
        {
            serialPort = newport;
            fs.unlinkSync(filename);
            var writer = fs.createWriteStream(filename);
            var data = { "portname" : serialPort };
            writer.write(JSON.stringify(data));
            writer.close();
            openSerialPort();
        }
        res.redirect('/'); 
        res.end();
    });
}
catch (error) {
    console.log(error);
}

openSerialPort();

var connections = new Array;
var port;
var parser;
function openSerialPort() {
    try {
        let rawdata = fs.readFileSync(__dirname + '/hudconfig.json');
        serialPort = JSON.parse(rawdata).portname;
        
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
    let output = "<html><head><title>ADAHRS-HUD SETTINGS</title><script src='https://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js'></script>" + 
      "<link rel='stylesheet' href='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.1/css/bootstrap.min.css'>" + 
      "<link rel='stylesheet' href='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.1/css/bootstrap-theme.min.css'>" +
      "<script src='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.1/js/bootstrap.min.js'></script>" + 
      "<style>input[type=submit] {background-color: rgb(10, 94, 20);border: none;color: white;padding: 20px 40px;text-decoration: none;" +
      "font-size: 20px;font-weight: bold;margin: 4px 2px;cursor: pointer;}</style></head><body><div style='margin:100px;'>" +
      "<nav class='navbar navbar-inverse navbar-static-top'><div class='container'><a class='navbar-brand href='/'>ADAHRS-HUD</a>" +
      "</div></nav><div class='jumbotron' style='padding:40px;'><h2>Please enter your serial port name</h2><p>" +
      "<h3><label for='portname'>Your serial to USB cable will use a named port, for example: /dev/ttyACM0</label></h3></p>" +
      "<form method='post' action='/config' novalidate><div class='form-field'><input type='text id='portname' name='portname'" + 
      "value='" + serialPort + "'></div><p><div class='form-actions'><input type='submit' value='Save'>" +
      "</div></p></form></div></div></body></html>";
      return output;
}