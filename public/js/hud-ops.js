'use strict';

var host;
var websock;

try {
    host = "ws://" + location.hostname + ":9696";
    websock = new WebSocket(host);
    
    websock.onopen = openSocket;
    websock.onmessage = onSerialData;
}
catch(error) {
    console.log(error);
}

function openSocket() {
  console.log("Websocket opened...");
}

(function($) {
  function AttitudeIndicator( placeholder, options ) {
    var settings = $.extend({
      size : 600,
      roll : 0,
      pitch : 0,
      showBox : true,
    }, options );

    var constants = {
      pitch_bound:90
    }

    placeholder.each(function(){
      $(this).html('<div class="instrument attitude"><div class="roll box"><img src="img/horizon_back.svg" class="box" alt="" /><div class="pitch box"><img src="img/horizon_ball.svg" class="box" alt="" /></div><img src="img/horizon_circle.svg" class="box" alt="" /></div><div class="mechanics box"><img src="img/horizon_airplane.svg" class="box" alt="" /></div></div>');
      _setRoll(settings.roll);
      _setPitch(settings.pitch);

      $(this).find('div.instrument').css({height : 500, width : 600}); 
      $(this).find('div.instrument img.box.background').toggle(settings.showBox);
    });

    function _setRoll(roll){
      placeholder.each(function(){
        $(this).find('div.instrument.attitude div.roll').css('transform', 'rotate('+roll+'deg)');
      });
    }

    function _setPitch(pitch){
      if(pitch>constants.pitch_bound){pitch = constants.pitch_bound;}
      else if(pitch<-constants.pitch_bound){pitch = -constants.pitch_bound;}
      placeholder.each(function(){
        $(this).find('div.instrument.attitude div.roll div.pitch').css('top', pitch*0.7 + '%');
      });
    }

    function _resize(size){
      placeholder.each(function(){
        $(this).find('div.instrument').css({height : size, width : size});
      });
    }

    function _showBox(){
      placeholder.each(function(){
        $(this).find('img.box.background').show();
      });
    }

    function _hideBox(){
      placeholder.each(function(){
        $(this).find('img.box.background').hide();
      });
    }

    this.setRoll = function(roll){_setRoll(roll);}
    this.setPitch = function(pitch){_setPitch(pitch);}
    this.resize = function(size){_resize(size);}
    this.showBox = function(){_showBox();}
    this.hideBox = function(){_hideBox();}

    return attitude;
  };

  $.attitudeIndicator = function(placeholder, options){
    var attitudeIndicator = new AttitudeIndicator($(placeholder), options)
    return attitudeIndicator;
  }

  $.fn.attitudeIndicator = function(options){
    return this.each(function(){
      $.attitudeIndicator(this, options);
    });
  }
}( jQuery ));

var speedtape = $('#speedtape');
var alttape = $('#alttape');
var headingtape = $('#headingtape');
var ball = $('#ball');
var attitude = $.attitudeIndicator('#attitude', 'attitude', {roll:50, pitch:-20, size:600, showBox : true});
var wind = $('.windindicator');
var aoa = $('.aoa');
var avgVspeed = new Array();
var isGarmin = false;

// offsets, in pixels per unit of measure
const spd_offset = 4.8;    // Knots
const alt_offset = .4792   // Feet MSL
const hdg_offset = 4.793;  // Degrees
const ball_offset = 6.7;   // Degrees
const ball_center = 68;    // this is "center" of the slip-skid indicator
const pitch_offset = 1.24; // this adjusts the pitch 

var speedbox = document.getElementById('spanspeedbox');
var altitudebox = document.getElementById('spanaltbox');
var headingbox = document.getElementById('spanheadingbox');
var gbox = document.getElementById('spangmeter');
var vspeedbox = document.getElementById('spanvspeed');
var arrowbox = document.getElementById('spanvsarrow');
var tasbox = document.getElementById("spantas");
var oatbox = document.getElementById("spanoat");
var daltbox = document.getElementById("spandalt");
var windarrow = document.getElementById("windarrow");
var windspeed = document.getElementById("spanwindspeed");
var barobox = document.getElementById("spanbaro");
var aoatext = document.getElementById('spanaoa');

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}


////////////////////////////////////////////////////////////////////////////////
  // Extract data from the serial data stream (string)
  //---------------------------------------------------------------------------
  // example data:
  // !1121144703-014+00003310811+01736+003-03+1013-033+110831245+01650023176C
  //////////////////////////////////////////////////////////////////////////////
function onSerialData(e) {
    var data = new HudData(e.data);

    if (!isGarmin && data.client == "garmin") {
        isGarmin = true;
        wind.css('left', '-1000');
    }

    attitude.setRoll(data.roll * -1);
    attitude.setPitch(data.pitch * pitch_offset);

    speedbox.textContent = data.airspeed;
    headingbox.textContent = data.heading;
    arrowbox.textContent = data.vertspeed < 0 ? "▼" : "▲";
    barobox.textContent = "BARO " + data.baropressure.toFixed(2);
    oatbox.textContent = "OAT " + data.oatF + " F";
    tasbox.textContent = "TAS " + data.tas + " kt";
    daltbox.textContent = "DALT " + (data.dalt >= 0 ? "+" + data.dalt : "-" + data.dalt);
    windspeed.textContent = isNaN(data.windkts) ? "-- kt" : data.windkts + " kt";
    altitudebox.textContent = data.baltitude;

    if (avgVspeed.length < 3) {
        avgVspeed.push(Math.abs(data.vertspeed));
    }
    else {
        vspeedbox.textContent = GetAverage(avgVspeed) + " fpm";
        avgVspeed.splice(0, avgVspeed.length);
    }
    
    var speedticks = (data.airspeed * spd_offset);
    var altticks = (data.baltitude * alt_offset);
    var hdgticks = (data.heading * hdg_offset) * -1;
    
    // check the AOA
    if (data.aoa >= 99) {
        aoa.css('visibility', 'visible');
        aoatext.textContent = "AOA-PUSH!";
    }
    else {
        aoa.css('visibility', 'hidden');
    }

    // set the coordinates of the tapes
    speedtape.css('transform', 'translateY(' + speedticks + 'px)');
    alttape.css('transform', 'translateY(' + altticks + 'px)');
    headingtape.css('transform', 'translateX('+ hdgticks + 'px)');

    gbox.textContent = (data.gLoad >= 0 ? "+" + data.gLoad : "-" + data.gLoad) + " g";
    
    // set the skid-slip ball position
    let ballposition = ball_center + (data.slipskid * ball_offset);
    ball.css('left', ballposition + 'px');
  
    // set the wind speed & direction
    if (data.winddirection < 180) {
        data.winddirection += 180;
    }
    else {
        data.winddirection -= 180; 
    } 
    windarrow.style.transform  = 'rotate('+ data.winddirection +'deg)';
}

function GetAverage(arrayToAverage) {
    var total = 0;
    var counter = 0;
    arrayToAverage.forEach(function(element) {
        if (!isNaN(element)) {
            total += element;
            counter ++;
        } 
    });
    return (total / counter).toFixed(0);
}

/* 
    ////////////////////////////////////////////////
    //          GARMIN MESSAGE FORMAT             //
    ////////////////////////////////////////////////
    FIELD       VALUE       OFFSET   LENGTH     END 
    ------------------------------------------------
    header:     =11         00 - 02  3 chars   =  3
    time:       HHMMSSMS    03 - 10  8 chars   = 11
    pitch:      +100        11 - 14  4 chars   = 15
    roll:       +0300       15 - 19  5 chars   = 20GetAverage(avgAltitude);
    heading:    180         20 - 22  3 chars   = 23
    airspeed:   1400        23 - 26  4 chars   = 27
    altitude:   004760      27 - 32  6 chars   = 33
    turn rate:  +100        33 - 36  4 chars   = 37
    slipskid:   +10         37 - 39  3 chars   = 40
    gmeter:     +10         40 - 42  3 chars   = 43
    aoa:        00          43 - 44  2 chars   = 45
    vertspeed:  +010        45 - 48  4 chars   = 49
    oat:        +27         49 - 51  3 chars   = 52
    baro:       050         52 - 54  3 chars   = 55
    checksum:   xx          55 - 56  2 chars   = 57
    CRLF        /n          57 - 58  2 chars   = 59
    ------------------------------------------------
    TOTAL CHAR COUNT                           = 59
    ------------------------------------------------
 
    ////////////////////////////////////////////////
    //           DYNON MESSAGE FORMAT             //
    ////////////////////////////////////////////////
    FIELD       VALUE       OFFSET   LENGTH     END 
    ------------------------------------------------
    header:     !11_        00 - 02  3 chars   =  3
    time:       HHMMSSMS    03 - 10  8 chars   = 11
    pitch:      +100        11 - 14  4 chars   = 15
    roll:       +0300       15 - 19  5 chars   = 20
    heading:    180         20 - 22  3 chars   = 23
    airspeed:   1400        23 - 26  4 chars   = 27
    altitude:   004760      27 - 32  6 chars   = 33
    turn rate:  +100        33 - 36  4 chars   = 37
    slipskid:   +10         37 - 39  3 chars   = 40
    gmeter:     +10         40 - 42  3 chars   = 43
    aoa:        00          43 - 44  2 chars   = 45
    vertspeed:  +010        45 - 48  4 chars   = 49
    oat:        +99         49 - 51  3 chars   = 52  
    tas:        0000        52 - 55  4 chars   = 56
    baro:       000         56 - 58  3 chars   = 59 
    dalt:       +00000      59 - 64  6 chars   = 65 
    wind dir:   000         65 - 67  3 chars   = 68
    wind speed: 00          68 - 69  2 chars   = 70
    checksum:   xx          70 - 71  2 chars   = 72
    CRLF:       /n          72 - 73  2 chars   = 74
    ------------------------------------------------
    TOTAL CHAR COUNT                           = 74
    ------------------------------------------------
*/
class HudData {
    constructor(sdata) {
        this.str = String(sdata);
        this.id = this.str.substr(0, 1);
        this.client = (this.id == "!" ? "dynon" : "garmin");
        
        // COMMON PROPERTIES BETWEEN BOTH CLIENTS
        this.pitch = (parseInt(this.str.substr(11, 4)) / 10);
        this.roll = (parseInt(this.str.substr(15, 5)) / 10);
        this.heading = parseInt(this.str.substr(20, 3));
        this.airspeed = Math.trunc(parseInt(this.str.substr(23, 4)) / 10);
        this.altitude = parseInt(this.str.substr(27, 6));
        this.turnrate = (parseInt(this.str.substr(33, 4)) / 10);
        this.slipskid = (parseInt(this.str.substr(37, 3)) / 10);
        this.gLoad = (parseInt(this.str.substr(40, 3)) / 10).toFixed(1);
        this.aoa = parseInt(this.str.substr(43, 2));
        this.vertspeed = Math.trunc(parseInt(this.str.substr(45, 4)) * 10);
        this.oatF = Math.ceil(parseInt(this.str.substr(49, 3)) * 1.8 + 32);
        this.oatC = parseInt(this.str.substr(49,3));

        if (this.client == "dynon") {   // Dynon furnishes these extra fields
            this.tas = Math.trunc(parseInt(this.str.substr(52, 4)) /10);
            this.baro = parseInt(this.str.substr(56, 3));
            this.dalt = parseInt(this.str.substr(59, 6));
            this.winddirection = parseInt(this.str.substr(65, 3));
            this.windkts = parseInt(this.str.substr(68, 2));
        }
        else if (this.client == "garmin") { // Garmin needs those fields calculated
            this.tas = tascalculator.tas(this.airspeed, this.altitude, this.oatC);
            this.baro = parseInt(this.str.substr(52, 3));
            var factor = (this.altitude * 2) / 1000;
            var adjustment = Math.trunc((this.oatC - (15 - factor)) * 120); 
            this.dalt = this.altitude + adjustment;  
            this.winddirection = 0;
            this.windkts = 0;
        }

        this.baropressure = ((this.baro / 100) + 27.5);
    
        var pafactor = 0;
        switch (true) {
          case (this.baropressure <= 28.0):
            pafactor = 1824;
            break;
          case (this.baropressure <= 28.1):
            pafactor = 1727;
            break;
          case (this.baropressure <= 28.2): 
            pafactor = 1630;
            break;
          case (this.baropressure <= 28.3):
            pafactor = 1533;
            break;
          case (this.baropressure <= 28.4):
            pafactor = 1436;
            break;
          case (this.baropressure <= 28.5):
            pafactor = 1340;
            break;
          case (this.baropressure <= 28.6):
            pafactor = 1244;
            break;
          case (this.baropressure <= 28.7):
            pafactor = 1148;
            break;
          case (this.baropressure <= 28.8):
            pafactor = 1053;
            break;
          case (this.baropressure <= 28.9):
            pafactor = 957;
            break;
          case (this.baropressure <= 29.0):
            pafactor = 863;
            break;
          case (this.baropressure <= 29.1):
            pafactor = 768;
            break;
          case (this.baropressure <= 29.2):
            pafactor = 673;
            break;
          case (this.baropressure <= 29.3): 
            pafactor = 579;
            break;
          case (this.baropressure <= 29.4):
            pafactor = 485;
            break;
          case (this.baropressure <= 29.5):
            pafactor = 392;
            break;
          case (this.baropressure <= 29.6):
            pafactor = 298;
            break;
          case (this.baropressure <= 29.7):
            pafactor = 205;
            break;
          case (this.baropressure <= 29.8):
            pafactor = 112;
            break;
          case (this.baropressure <= 29.9):
            pafactor = 20;
            break;
          case (this.baropressure <= 29.92):
            pafactor = 0;
            break;
          case (this.baropressure <= 30.0):
            pafactor = -73;
            break;
          case (this.baropressure <= 30.1):
            pafactor = -165;
            break;
          case (this.baropressure <= 30.2):
            pafactor = -257;
            break;
          case (this.baropressure <= 30.3):
            pafactor = -348;
            break;
          case (this.baropressure <= 30.4):
            pafactor = -440;
            break;
          case (this.baropressure <= 30.5):
            pafactor = -531;
            break;
          case (this.baropressure <= 30.6):
            pafactor = -622;
            break;
          case (this.baropressure <= 30.7):
            pafactor = -712;
            break;
          case (this.baropressure <= 30.8):
            pafactor = -803;
            break;
          case (this.baropressure <= 30.9):
            pafactor = -893;
            break;
          case (this.baropressure <= 31.0):
            pafactor = -983;
            break;
          default:
            pafactor = 0;
            break;
        }

        let baltfactor = pafactor * (29.92 - this.baropressure);
        this.baltitude = round10(this.altitude + baltfactor);
    }
}

function round10(number)
{
    return (Math.round(number / 10) * 10);
}

// TAS
var tascalculator = {
    tas: function(ias, msl) {
        var ias2 = ias * .02;
        var msl2 = Math.floor(msl / 1000);
        return Math.round((ias2 * msl2) + ias);
    }
 };

function perRound(num, precision) {
    var precision = 3 //default value if not passed from caller, change if desired
    // remark if passed from caller
    precision = parseInt(precision) // make certain the decimal precision is an integer
    var result1 = num * Math.pow(10, precision)
    var result2 = Math.round(result1)
    var result3 = result2 / Math.pow(10, precision)
    return zerosPad(result3, precision)
}

function zerosPad(rndVal, decPlaces) {
    var valStrg = rndVal.toString() // Convert the number to a string
    var decLoc = valStrg.indexOf('.') // Locate the decimal point

    // check for a decimal
    if (decLoc == -1) {
        decPartLen = 0 // If no decimal, then all decimal places will be padded with 0s
        // If decPlaces is greater than zero, add a decimal point
        valStrg += decPlaces > 0 ? '.' : ''
    } 
    else {
        decPartLen = valStrg.length - decLoc - 1 // If there is a decimal already, only the needed decimal places will be padded with 0s
    }
    var totalPad = decPlaces - decPartLen // Calculate the number of decimal places that need to be padded with 0s

    if (totalPad > 0) {
        // Pad the string with 0s
        for (var cntrVal = 1; cntrVal <= totalPad; cntrVal++) valStrg += '0'
    }
    return valStrg
}

// send the value in as "num" in a variable

// clears field of default value

function clear_field(field) {
    if (field.value == field.defaultValue) {
        field.value = ''
    }
}


