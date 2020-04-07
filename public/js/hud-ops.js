
/////////////////////////////////////////////////////////////////////
// Node.js serialport implementation - raise the parser.data event 
// when data comes in from the Dynon ADAHRS serial port
///////////////////////////////////////////////////////////////////// 

var host;
var websock;

try {
    let host = "ws://" + location.hostname + ":9696";
    let websock = new WebSocket(host);
    
    websock.onopen = openSocket;
    websock.onmessage = onSerialData;
}
catch(error) {
    console.log(error);
}

function openSocket() {
  //console.log("Websocket OPENED!");
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

$(document).keyup(function(e) {
    console.log(e.keyCode);
    //e.data = "!1121144703-014+00003310811+01736+003-03+1013-033+110831245+01650023176C";
    //        !1121144703-014+00003310811+01736+003-03+1013-033+110831245+01650023176C
    e.data = "=1121144703-300+03003310811+01736+003-03+1013-033+11245xx/n";
    onSerialData(e);
});


var speedtape = $('#speedtape');
var alttape = $('#alttape');
var headingtape = $('#headingtape');
var ball = $('#ball');
var attitude = $.attitudeIndicator('#attitude', 'attitude', {roll:50, pitch:-20, size:600, showBox : true});
var wind = $('.windindicator');
var aoa = $('.aoa');

// offsets, in pixels per unit of measure
const spd_offset = 4.8;    // Knots
const alt_offset = .4792   // Feet MSL
const hdg_offset = 4.793;  // Degrees
const ball_offset = -4;    // Degrees
const ball_center = 44.5;  // this is "center" of the slip-skid indicator
const pitch_offset = 1.28; // this adjusts the pitch to match Stratux

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

    attitude.setRoll(data.roll * -1);
    attitude.setPitch(data.pitch * pitch_offset);

    // set these values to a reasonable precision
    gnumber = data.gLoad;
    slipskid = data.slipskid;
    strdalt = data.dalt >= 0 ? "+" + data.dalt : "-" + data.dalt;

    speedbox.textContent = data.airspeed;
    altitudebox.textContent = data.baltitude;
    headingbox.textContent = data.heading;
    vspeedbox.textContent = data.vertspeed + " fpm";
    barobox.textContent = "BpHg " + data.baropressure;
    arrowbox.textContent = data.vertspeed < 0 ? "▼" : "▲";
    oatbox.textContent = "OAT " + data.oatF + " F";
    tasbox.textContent = "TAS " + data.tas + " kt";
    daltbox.textContent = "DAlt " + strdalt;
    windspeed.textContent =  data.windkts + " kt"

    var speedticks = (data.airspeed * spd_offset);
    var altticks = (data.altitude * alt_offset);
    var hdgticks = (data.heading * hdg_offset) * -1;

    if (data.client == "garmin") {
        wind.css('left', '-1000');
    }
    
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

    var tmpgnumber = gnumber >= 0 ? "+" + gnumber : "-" + gnumber;
    gbox.textContent =  tmpgnumber + " g";

    // set the skid-slip ball position
    slipskid = slipskid * -1;
    if (slipskid < -17) {
        slipskid = -17;
    }
    else if (slipskid > 17) {
        slipskid = 17;
    }
    var ballposition = ball_center + (slipskid * ball_offset);
    ball.css('left', ballposition + 'px');
  
    // set the wind speed & direction
    // fix for backwards arrow 
    if (data.winddirection < 180) {
        data.winddirection += 180;
    }
    else {
        data.winddirection -= 180; 
    } 
    windarrow.style.transform  = 'rotate('+ data.winddirection +'deg)';
}

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
        this.slipskid = (parseInt(this.str.substr(37, 3)) / 100);
        this.gLoad = (parseInt(this.str.substr(40, 3)) / 10).toFixed(1);
        this.aoa = parseInt(this.str.substr(43, 2));
        this.vertspeed = Math.trunc(parseInt(this.str.substr(45, 4)) * 10);
        this.oatF = (parseInt(this.str.substr(49, 3)) * 1.8 + 32);
        this.oatC = parseInt(this.str.substr(49,3));

        if (this.client == "dynon") { 
            this.tas = Math.trunc(parseInt(this.str.substr(52, 4)) /10);
            this.baro = parseInt(this.str.substr(56, 3));
            this.dalt = parseInt(this.str.substr(59, 6));
            this.winddirection = parseInt(this.str.substr(65, 3));
            this.windkts = parseInt(this.str.substr(68, 2));
        }
        else if (this.client == "garmin") { 
            this.tas = tascalculator.tas(this.airspeed, this.altitude, this.oat);
            this.baro = parseInt(this.str.substr(52, 3));
            //this.baropressure = ((this.baro / 100) + 27.5);
            var factor = (this.altitude * 2) / 1000;
            var adjustment = Math.trunc((this.oatC - (15 - factor)) * 120); 
            this.dalt = this.altitude + adjustment;  
            this.winddirection = 0;
            this.windkts = 0;
        }

        this.baropressure = ((this.baro / 100) + 27.5);
        let baltfactor = 1000 * (29.92 - this.baropressure);
        this.baltitude = Math.trunc(this.altitude + baltfactor);
    }
}

// TAS

var tascalculator = {
    tas: function(ias, msl) {
        var ias2 = ias * .02;
        var msl2 = Math.floor(msl / 1000);
        return Math.round((ias2 * msl2) + ias);
    }
 };

/* 
    GARMIN MESSAGE FORMAT
    ------------------------------------------------
    header:     =11         00 - 02  3 chars   =  3
    ------------------------------------------------
    time:       HHMMSSMM    03 - 10  8 chars   = 11
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
    oat:        +27         49 - 51  3 chars   = 52
    baro:       050         52 - 54  3 chars   = 55
    checksum:   xx          55 - 56  2 chars   = 57
    CRLF        /n          57 - 58  2 chars   = 59
    ------------------------------------------------
    TOTAL CHAR COUNT                           = 59

    sample message:   "=1108103249+100+03001801400004760+100+10+1000+010+27050XX/n"

    DYNON MESSAGE FORMAT
    -----------------------------------------------------------
    Position____width____Name_________________data______type
    -----------------------------------------------------------
    1           1        Start                !         string   
    2           1        Data Type            1         number
    3           1        Data Version         1         number
    4           8        System Time          HHMMSSFF  string
    12          4        Pitch (deg)          +- 000    number
    16          5        Roll (deg)           +- 1800   number
    21          3        Magnetic Heading     000 (deg) number
    24          4        Indicated Airspeed   9999      number
    28          6        Pressure Altitude    +- 00000  number 
    34          4        Turn Rate (deg/s)    +- 000    number
    38          3        Lateral Accel (g)    +- 00     number
    41          3        Vertical Accel(g)    +- 00     number
    44          2        Angle of Attack (%)  00        number
    46          4        Vertical Speed       +- 000    number
    50          3        OAT (deg C)          +- 00     number 
    53          4        True Airspeed        0000      number
    57          3        Barometer Setting    000       number
    60          6        Density Altitude     +- 00000  number
    66          3        Wind Direction       000       number
    69          2        Wind Speed           00        number
    71          2        Checksum             00        hex 
    73          2        CR/LF                /n        string
    -----------------------------------------------------------
    TOTAL CHARS = 74
*/

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
    } else {
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


