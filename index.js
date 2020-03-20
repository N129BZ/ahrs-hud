
const minimist = require('minimist');
const express = require('express');
const http = require('http');
const SerialPort = require('serialport');			
const WebSocketServer = require('websocket').server;     
const Readline = require('@serialport/parser-readline');

var args = minimist(process.argv.slice(2), {
    
    alias: {
        h: 'http',
        s: 'serial',
        w: 'websocket'
    },
    default: { 
        h: 8686,
        s: '/dev/ttyACM0',
        w: 9696 
    },
});

var websockport = args['websocket']; 
var serialport = args['serial']; 
var webserverport = args['http'];

var server = http.createServer(function(request, response) { });
try {
  server.listen(websockport, function() { });
  // create the server
  wss = new WebSocketServer({
    httpServer: server
  });
  console.log("Websocket server listening at port " +  websockport);
}
catch(error) {
  console.log(error);
}

var connection;
try {
  wss.on('request', function(request) {
    connection = request.accept(null, request.origin);
    handleConnection(connection);

    // This is the most important callback for us, we'll handle
    // all messages from users here.
    connection.on('message', function(message) {
        // do nothing
    });

    connection.on('close', function(connection) {
      // close user connection
    });
  });
}
catch(error) {
  console.log(error);
}

var webserver;
try {
  webserver = express();
  webserver.listen(webserverport, () => {
    console.log("Webserver listening at port " + webserverport);
  });

  webserver.use(express.static(__dirname + "/public"));

  webserver.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html"); 
  });
}
catch(error) {
  console.log(error);
}

var connections = new Array;
var port;
var parser;
try {
  port = new SerialPort(serialport);    // open the port
  parser = port.pipe(new Readline({ delimiter: '\n' }));

  port.on('open', showPortOpen);   
  port.on('close', showPortClose); 
  port.on('error', showError);   
  parser.on('data', sendDataToBrowser);  
}
catch(error) {
  console.log(error);
}


// ------------------------ Serial event functions:
// this is called when the serial port is opened:
function showPortOpen() {
  console.log("serial port opened at " + serialport);
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
  console.log("New Connection");        // you have a new client
  connections.push(client);             

  client.on('close', function() {           // when a client closes its connection
	console.log("connection closed");       // print it out
    var position = connections.indexOf(client); // get the client's position in the array
	connections.splice(position, 1);
  });
}
