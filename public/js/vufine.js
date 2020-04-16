

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

$(document).keyup(function(e) {
    console.log(e.keyCode);

    //   DYNON SAMPLE
       e.data = "!1121144703-014+00003310811+01736+033-15+1013-033+110831245+01650023176C\r\n";
    //   GARMIN SAMPLE  
      //e.data = "=1121144703-150+03003310811+01736+003+99+1013-033+11245xx\r\n";
    
    onSerialData(e);
});

var ball = $('#ball');
var aoa = $('.aoa');

const ball_offset = 6.7;   // Degrees
const ball_center = 68;    // this is "center" of the slip-skid indicator

var speedbox = document.getElementById('spanspeedbox');
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

    slipskid = data.slipskid;
    speedbox.textContent = data.airspeed;
    
    // check the AOA
    if (data.aoa >= 99) {
        aoa.css('visibility', 'visible');
        aoatext.textContent = "AOA-PUSH!";
    }
    else {
        aoa.css('visibility', 'hidden');
    }

    // set the skid-slip ball position
    let ballposition = ball_center + (slipskid * ball_offset);
    ball.css('left', ballposition + 'px');
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
        this.oatF = (parseInt(this.str.substr(49, 3)) * 1.8 + 32);
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


