'use strict'

var websock;
var hitmap = new Map();
var trafficWebSocket;
var ahrsWebSocket;
var wsOpen = false;
var lastTrafficTimestamp;

var clrCount = 0;
var countCycle = 0;
var myAlt = 0;
var warning_altitude = 0;
var warning_distance = 0;
const warning_maxage = 20;
var coursearrow;
var speedStyle = "KT";
var warningIdentity;
var warningAltitude;
var warningDistance;
var warningCourse;
var warningAge;
var hitbearing = 0;
var useStratuxAHRS = false;
var timestamp = Date.now();
var isWarning = false;
var warningVisible = false;

var stxip = document.getElementById("stxipaddr").value;
var serverip = document.getElementById("serveripaddr").value;
var wsp = parseInt(document.getElementById("wsport").value);
var httpPort = location.port;
var urlTraffic = "ws://" + stxip + "/traffic";
var urlAHRS = "http://" + stxip + "/getSituation";
var urlCageAHRS = "http://" + stxip + "/cageAHRS";
var urlResetGMeter = "http://" + stxip + "/resetGMeter";
var urlSerialData = "ws://" + serverip + ":" + wsp;

var KNOTS = "KT";
var MPH = "MPH";
var KPH = "KPH";

var MILES = "miles";
var KLIKS = "km";
var NMILES = "nm";
var distanceMeasure = MILES;

var windindicator = $('.windindicator');
var tasindicator = $('.tasbox');
var oatindicator = $('.oatbox');
var baroindicator = $('.barobox');
var daltindicator = $('.daltbox');
var vsarrow = $('.vsarrowbox');
var vsindicator = $('.vsbox');
var courseindicator = $('.courseindicator');
var coursecircle = $('.coursecircle');
var coursearrow = $('.coursearrow');
coursecircle.css("visibility", "hidden");
coursearrow.css("visibility", "hidden");

// traffic warning image & elements
var svgTraffic = document.getElementById("trafficwarning");
svgTraffic.addEventListener("load", function () {
    var svgDoc = svgTraffic.contentDocument;
    warningIdentity = svgDoc.getElementById("ident");
    warningAltitude = svgDoc.getElementById("alt");
    warningDistance = svgDoc.getElementById("dist");
    warningCourse = svgDoc.getElementById("crs");
    warningAge = svgDoc.getElementById("age");
}, false);

var svgArrow = document.getElementById("coursearrow");
svgArrow.addEventListener("load", function () {
    var svgDoc = svgArrow.contentDocument;
    coursearrow = svgDoc.getElementById("arrow");
}, false);

var usestx = document.getElementById("ahrs").value;
useStratuxAHRS = (usestx == "Stratux");
speedStyle = document.getElementById("speedstyle").value;
var speedFactor = 1; // default in traffic messages is KNOTS

switch (speedStyle) {
    case MPH:
        speedFactor = 1.15078;
        distanceMeasure = MILES;
        break;
    case KPH:
        speedFactor = 1.852;
        distanceMeasure = KLIKS;
        break;
    default:
        distanceMeasure = NMILES;
        break;
}

$(() => {
    if (!useStratuxAHRS) {
        try {
            var websock = new WebSocket(urlSerialData);
            websock.onmessage = onHostData;
        }
        catch (error) {
            console.log(error);
        }
    }
    else {
        windindicator.css("left", "-1000");
        tasindicator.css("left", "-1000");
        runStratuxAhrs();
    }

    var twelement = document.getElementById("trafficwarnings");
    var trafficWarnings = (twelement.value == "true");

    if (trafficWarnings) {
        warning_altitude = parseInt(document.getElementById("maxwarnaltitude").value);
        warning_distance = parseInt(document.getElementById("maxwarndistance").value);

        trafficWebSocket = new WebSocket(urlTraffic);
        trafficWebSocket.onopen = function (evt) { onTrafficOpen(evt); };
        trafficWebSocket.onclose = function (evt) { onTrafficClose(evt); };
        trafficWebSocket.onmessage = function (evt) { onTrafficMessage(evt); };
    }
});

// if a keyboard is in place, process key strokes
$(document).keyup(function(e) {
    console.log(e.keyCode);
    var kc = e.keyCode;
   
    switch(kc) {
    case 67:    // "c" as in [C]age AHRS
    case 97:    // "1"
    case 49:
        $.post(urlCageAHRS);
        break;
    case 65:    // "a" as in calibrate [A]HRS
    case 98:    // "2"
    case 50:
        $.post("http://" + stxip + "/calibrateAHRS");
        break;
    case 83:    // "s" as in [S]etup
    case 99:    // "3"
    case 51:
        location.href = "http://" + serverip + ":" + httpPort + "/setup";
        break;
    case 71:    // "g" as in reset [G]meter
    case 100:   // "4"
    case 52:
        $.post("http://" + stxip + "/resetGMeter");
        break;
    case 66:    // "b" as in re[B]oot"
    case 101:   // "5"
    case 53:
        $.post("http://" + stxip + "/reboot");
        break;
    case 75:    // "k" as in [K]ill stratux
    case 102:   // "7"
    case 55:
        $.post("http://" + stxip + "/shutdown");
        break;
    case 88:    // "x" as in statu[X] settings page
    case 104:   // "8"
    case 56:
        location.href = "http://" + stxip
        break;
    case 76:    // "l" as in re[L]oad
    case 96:    // "0"
    case 48:
        location.reload();
        break;
    case 87:    // "w" as in show proximity [W]arnings  
    case 105:   // "9" - toggle traffic image
    case 57:
        showWarning = !showWarning;
        setWarningBox();
        break;
    }
});

(function ($) {
    function AttitudeIndicator(placeholder, options) {
        var settings = $.extend({
            size: 600,
            roll: 0,
            pitch: 0,
            showBox: true,
        }, options);

        var constants = {
            pitch_bound: 90
        };

        placeholder.each(function () {
            $(this).html('<div class="instrument attitude"><div class="roll box"><img src="img/horizon_back.svg" class="box" alt="" /><div class="pitch box"><img src="img/horizon_ball.svg" class="box" alt="" /></div><img src="img/horizon_circle.svg" class="box" alt="" /></div><div class="mechanics box"><img src="img/horizon_airplane.svg" class="box" alt="" /></div></div>');
            _setRoll(settings.roll);
            _setPitch(settings.pitch);

            $(this).find('div.instrument').css({ height: 500, width: 600 });
            $(this).find('div.instrument img.box.background').toggle(settings.showBox);
        });

        function _setRoll(roll) {
            placeholder.each(function () {
                $(this).find('div.instrument.attitude div.roll').css('transform', 'rotate(' + roll + 'deg)');
            });
        }

        function _setPitch(pitch) {
            if (pitch > constants.pitch_bound) { pitch = constants.pitch_bound; }
            else if (pitch < -constants.pitch_bound) { pitch = -constants.pitch_bound; }
            placeholder.each(function () {
                $(this).find('div.instrument.attitude div.roll div.pitch').css('top', pitch * 0.7 + '%');
            });
        }

        function _resize(size) {
            placeholder.each(function () {
                $(this).find('div.instrument').css({ height: size, width: size });
            });
        }

        function _showBox() {
            placeholder.each(function () {
                $(this).find('img.box.background').show();
            });
        }

        function _hideBox() {urlSerialData
            placeholder.each(function () {
                $(this).find('img.box.background').hide();
            });
        }

        this.setRoll = function (roll) { _setRoll(roll); };
        this.setPitch = function (pitch) { _setPitch(pitch); };
        this.resize = function (size) { _resize(size); };
        this.showBox = function () { _showBox(); };
        this.hideBox = function () { _hideBox(); };

        return attitude;
    }

    $.attitudeIndicator = function (placeholder, options) {
        var attitudeIndicator = new AttitudeIndicator($(placeholder), options);
        return attitudeIndicator;
    };

    $.fn.attitudeIndicator = function (options) {
        return this.each(function () {
            $.attitudeIndicator(this, options);
        });
    };
}(jQuery));

var speedtape = $('#speedtape');
var alttape = $('#alttape');
var headingtape = $('#headingtape');
var ball = $('#ball');
var attitude = $.attitudeIndicator('#attitude', 'attitude', { roll: 50, pitch: -20, size: 600, showBox: true });
var aoa = $('.aoa');
var avgVspeed = new Array(10);
var isGarmin = false;

// offsets, in pixels per unit of measure
var spd_offset = 4.8;    // Knots
var alt_offset = .4792;   // Feet MSL
var hdg_offset = 4.793;  // Degrees
var ball_offset = 6.7;   // Degrees
var ball_center = 68;    // this is "center" of the slip-skid indicator
var pitch_offset = (useStratuxAHRS ? 1.19 : 1.24); // this adjusts the pitch 

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
var windcircle = document.getElementById("windcircle");
var windspeed = document.getElementById("spanwindspeed");
var windlabel = document.getElementById("spanwindlabel");
var barobox = document.getElementById("spanbaro");
var aoatext = document.getElementById('spanaoa');

function pad(num, size) {
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}
var svgns = "http://www.w3.org/2000/svg";


function onHostData(e) {

    var data = new HudData(e.data);

    //////////////////////////////////////////////////////////////////////////////
    //---------------------------------------------------------------------------
    // example data:
    // !1121144703-014+00003310811+01736+003-03+1013-033+110831245+01650023176C
    //////////////////////////////////////////////////////////////////////////////
    if (!isGarmin && data.client == "garmin") {
        isGarmin = true;
        windindicator.css('left', '-1000');
    }

    attitude.setRoll(data.roll * -1);
    attitude.setPitch(data.pitch * pitch_offset);

    speedbox.textContent = data.airspeed;
    headingbox.textContent = data.heading;
    arrowbox.textContent = data.vertspeed < 0 ? "▼" : "▲";
    barobox.textContent = "BARO " + data.baropressure.toFixed("2");
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
    myAlt = data.baltitude;

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
    headingtape.css('transform', 'translateX(' + hdgticks + 'px)');

    gbox.textContent = (data.gLoad >= 0 ? "+" + data.gLoad : "-" + data.gLoad) + " g";

    // set the skid-slip ball position
    var ballposition = ball_center + (data.slipskid * ball_offset);
    ball.css('left', ballposition + 'px');

    // set the wind speed & direction
    if (data.winddirection < 180) {
        data.winddirection += 180;
    }
    else {
        data.winddirection -= 180;
    }
    windarrow.style.transform = 'rotate(' + data.winddirection + 'deg)';
    data = null; 
}

function GetAverage(arrayToAverage) {
    var total = 0;
    var counter = 0;
    arrayToAverage.forEach(function (element) {
        if (!isNaN(element)) {
            total += element;
            counter++;
        }
    });
    return (total / counter).toFixed(0);
}

function round10(number) {
    return (Math.round(number / 10) * 10);
}

// TAS
var tascalculator = {
    tas: function (ias, msl) {
        var ias2 = ias * .02;
        var msl2 = Math.floor(msl / 1000);
        return Math.round((ias2 * msl2) + ias);
    }
};

function perRound(num, precision) {
    var newprecision = 3; //default value if not passed from caller, change if desired
    // remark if passed from caller
    newprecision = Number(precision).toFixed(0); // make certain the decimal precision is an integer
    var result1 = num * Math.pow(10, newprecision);
    var result2 = Math.round(result1);
    var result3 = result2 / Math.pow(10, newprecision);
    return zerosPad(result3, newprecision);
}

function zerosPad(rndVal, decPlaces) {
    var valStrg = rndVal.toString(); // Convert the number to a string
    var decLoc = valStrg.indexOf('.'); // Locate the decimal point
    var decPartLen = 0;
    // check for a decimal
    if (decLoc == -1) {
        // If no decimal, then all decimal places will be padded with 0s
        // If decPlaces is greater than zero, add a decimal point
        valStrg += decPlaces > 0 ? '.' : '';
    }
    else {
        decPartLen = valStrg.length - decLoc - 1; // If there is a decimal already, only the needed decimal places will be padded with 0s
    }
    var totalPad = decPlaces - decPartLen; // Calculate the number of decimal places that need to be padded with 0s

    if (totalPad > 0) {
        // Pad the string with 0s
        for (var cntrVal = 1; cntrVal <= totalPad; cntrVal++) valStrg += '0';
    }
    return valStrg;
}

function runHeartbeatRoutine() {
    var data = new Date().getTime();
    sendKeepAlive(data);
    console.log("((💜))")
}

function sendKeepAlive(data) {
    var rs = trafficWebSocket.readyState;
    if (rs == 1) {
        trafficWebSocket.send(data);
    }
    checkForExpiredWarnings();
}

function checkForExpiredWarnings() {
    if (hitmap.size > 0) {
        var now = new Date().getTime();
        hitmap.forEach(function(item) {
            var elapsed = (now - item.timestamp) / 1000;
            if (item.age > warning_maxage || 
                item.dist > warning_distance ||
                elapsed >= warning_maxage) {

                hitmap.delete(item.reg)
            }
        });
        if (hitmap.size == 0) {
            toggleTrafficWarning(false);
        }
    }
}

function onError(evt) {
    console.log("Traffic websocket ERROR: " + evt.data);
}

function onTrafficOpen(evt) {
    console.log("Traffic warning websocket successfully connected to Stratux!");
    wsOpen = true;
    setInterval(runHeartbeatRoutine, 8000);
}

function onTrafficClose(evt) {
    console.log("Traffic warning Websocket CLOSED.");
    wsOpen = false;
}

function onTrafficMessage(evt) {
    /*-----------------------------------------------------------------------------------------    
                                 Traffic JSON sample 
    -------------------------------------------------------------------------------------------
        {"Icao_addr":11316589,"Reg":"N916EV","Tail":"N916EV","Emitter_category":0,
        "OnGround":false,"Addr_type":0,"TargetType":0,"SignalLevel":-28.00244822746525,
        "Squawk":0,"Position_valid":false,"Lat":0,"Lng":0,"Alt":5550,"GnssDiffFromBaroAlt":0,
        "AltIsGNSS":false,"NIC":0,"NACp":0,"Track":0,"Speed":0,"Speed_valid":false,"Vvel":0,
        "Timestamp":"2019-03-12T13:32:30.563Z","PriorityStatus":0,"Age":18.2,"AgeLastAlt":1.83,
        "Last_seen":"0001-01-01T00:39:27.49Z","Last_alt":"0001-01-01T00:39:43.86Z",
        "Last_GnssDiff":"0001-01-01T00:00:00Z","Last_GnssDiffAlt":0,"Last_speed":"0001-01-01T00:00:00Z",
        "Last_source":1,"ExtrapolatedPosition":false,"BearingDist_valid":true,
        "Bearing":92.7782277589171,"Distance":9.616803034808295e+06}
    --------------------------------------------------------------------------------------------*/
    var obj = JSON.parse(evt.data);
    var meters = Math.round(Number(obj.Distance));
    var dist = 0;
    var brng = Math.round(Number(obj.Bearing));
    var reg = obj.Reg != "" ? obj.Reg : obj.Tail;
    var alt = Number(obj.Alt);
    var spd = Number(obj.Speed);
    var age = Math.round(obj.Age);
    var newtimestamp = Date.now(); 
    var spdOut = Math.round(spd * speedFactor);
    var airborne = !obj.OnGround;
    var distlabel;
    var strdate = new Date();

    myAlt = Number(altitudebox.textContent);
    
    // incoming reported speed is in KT, translation factor is 
    // set at app load depending on user's chosen display type
    spdOut = Math.round(spd * speedFactor);
    var course = brng + "\xB0 @ " + spdOut + " " + speedStyle.toLowerCase();

    switch (speedStyle) {
        case KNOTS: // convert meters to nautical miles 
            dist =  Math.round(meters * 0.000539957);
            distlabel = " nm";
            break;
        case MPH: // convert meters to statute miles
            dist = Math.round(meters * 0.000621371);
            distlabel = " mi";
            break;
        default: // convert meters to kilometers
            dist = Math.round(meters * 0.001);
            distlabel = " km";
    }

    isWarning = false;
    try {
        if (airborne && alt > 0 && dist > 0) {
            
            var airplane = {"reg": reg, "age": age, "dist": dist, "alt": alt, "brng": brng, "course": course, 
                            "date": strdate, "serveripaddr": serverip, "timestamp": newtimestamp };
            if (dist > warning_distance) {
                hitmap.delete(reg);
            }
            else if ((dist <= warning_distance && alt != 0 && spdOut != 0) &&
                     (alt <= myAlt + warning_altitude && alt >= myAlt - warning_altitude) &&
                     (brng > 0 && spdOut > 0) && (newtimestamp > timestamp)) {
                hitmap.set(reg, airplane);
                timestamp = newtimestamp;
                var airplanes = Array.from(hitmap.values()).sort(function(a,b) {
                    return (a.dist > b.dist) ? 1 : -1;
                }).filter(function (e) {
                    return (e.dist <= warning_distance && e.age <= warning_maxage);
                });
                if (airplanes.length > 0) {
                    var hit = airplanes[0];
                    warningIdentity.textContent = hit.reg;
                    warningAltitude.textContent = hit.alt;
                    warningDistance.textContent = hit.dist + distlabel;
                    warningCourse.textContent = hit.course;
                    warningAge.textContent = hit.age;
                    hitbearing = hit.brng;
                    lastTrafficTimestamp = hit.timestamp;
                    console.log(hit);
                
                    airplanes.forEach(function(item) {
                        if (item.reg != hit.reg) {
                            hitmap.delete(item.reg)
                        }
                    });
                }
                airplanes = null;
            }

            if (hitmap.size > 0) {
                toggleTrafficWarning(true, hitbearing);
            }
            else {
                toggleTrafficWarning(false);
            }
        }
        else {
            hitmap.delete(reg);
        }
    }
    catch (error) {
        console.log(error);
    }
}

function getSeconds(startTime, endTime) {
    var diffMs = (endTime - startTime); // milliseconds between endTime and startTime
    return Math.abs(Math.round(diffMs * .001));
}

function toggleTrafficWarning(isVisible, bearing = 0) {
    if (isVisible) {
        svgTraffic.setAttribute("style", "visibility: visible");
        courseindicator.css("visibility", "visible");
        svgArrow.setAttribute("style", "transform: rotate(" + bearing + "deg)");
        warningVisible = true;
    }
    else {
        svgTraffic.setAttribute("style", "visibility: hidden");
        svgArrow.setAttribute("style", "visibility: hidden");
        courseindicator.css("visibility", "hidden");
        warningVisible = false;
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//      JSON output returned by Stratux from a POST to http://[ipaddress]/getSituation (AHRS data)
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// {"GPSLastFixSinceMidnightUTC":0,"GPSLatitude":0,"GPSLongitude":0,"GPSFixQuality":0,"GPSHeightAboveEllipsoid":0,"GPSGeoidSep":0,
//  "GPSSatellites":0,"GPSSatellitesTracked":0,"GPSSatellitesSeen":2,"GPSHorizontalAccuracy":999999,"GPSNACp":0,"GPSAltitudeMSL":0,
//  "GPSVerticalAccuracy":999999,"GPSVerticalSpeed":0,"GPSLastFixLocalTime":"0001-01-01T00:00:00Z","GPSTrueCourse":0,"GPSTurnRate":0,
//  "GPSGroundSpeed":0,"GPSLastGroundTrackTime":"0001-01-01T00:00:00Z","GPSTime":"0001-01-01T00:00:00Z",
//  "GPSLastGPSTimeStratuxTime":"0001-01-01T00:00:00Z","GPSLastValidNMEAMessageTime":"0001-01-01T00:01:33.5Z",
//  "GPSLastValidNMEAMessage":"$PUBX,00,000122.90,0000.00000,N,00000.00000,E,0.000,NF,5303302,3750001,0.000,0.00,0.000,,99.99,99.99,99.99,0,0,0*20",
//  "GPSPositionSampleRate":0,"BaroTemperature":22.1,"BaroPressureAltitude":262.4665,"BaroVerticalSpeed":-0.6568238,
//  "BaroLastMeasurementTime":"0001-01-01T00:01:33.52Z","AHRSPitch":-1.7250436907060585,"AHRSRoll":1.086912223392926,
//  "AHRSGyroHeading":3276.7,"AHRSMagHeading":3276.7,"AHRSSlipSkid":-0.6697750324029778,"AHRSTurnRate":3276.7,
//  "AHRSGLoad":0.9825397416431592,"AHRSGLoadMin":0.9799488522426687,"AHRSGLoadMax":0.9828301105039375,
//  "AHRSLastAttitudeTime":"0001-01-01T00:01:33.55Z","AHRSStatus":6}
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function runStratuxAhrs() {
    var speed = 0;
    var altitude = 0;
    var heading = "";
    var vertspeed = 0;
    oatindicator.css("left", "-1000");
    baroindicator.css("left", "-1000");
    daltindicator.css("left", "-1000");
    vsarrow.css("top", "422px");
    vsindicator.css("top", "422px");

    fetch(urlCageAHRS);
    fetch(urlResetGMeter);
    try {
        setInterval(function () {
            fetch(urlAHRS)
                .then(function (response) {
                    return response.json();
                })
                .then(function (myJson) {
                    var str = JSON.stringify(myJson);
                    var obj = JSON.parse(str);

                    // attitude pitch & roll
                    attitude.setRoll(obj.AHRSRoll * -1);
                    attitude.setPitch(obj.AHRSPitch * pitch_offset);

                    // set these values to a reasonable precision
                    var gnumber = obj.AHRSGLoad.toFixed(1);
                    var slipskid = Math.trunc(obj.AHRSSlipSkid);
                    var oat = Math.trunc((obj.BaroTemperature * 1.8) + 32, 0) + "\xB0 F";
                    speed = Number(obj.GPSGroundSpeed * speedFactor).toFixed(0); 
                    altitude = Math.trunc(obj.GPSAltitudeMSL);
                    heading = pad(Math.trunc(obj.GPSTrueCourse), 3);
                    vertspeed = Math.trunc(obj.GPSVerticalSpeed);
                    // set the speed, altitude, heading, and GMeter values
                    speedbox.textContent = speed;
                    altitudebox.textContent = altitude;
                    headingbox.textContent = heading;
                    vspeedbox.textContent = Math.abs(vertspeed) + " FPM";
                    arrowbox.textContent = (vertspeed < 0 ? "▼" : "▲");
                    oatbox.textContent = oat;
                    var speedticks = (speed * spd_offset);
                    var altticks = (altitude * alt_offset);
                    var hdgticks = (heading * hdg_offset) * -1;

                    // set the coordinates of the tapes
                    speedtape.css('transform', 'translateY(' + speedticks + 'px)');
                    alttape.css('transform', 'translateY(' + altticks + 'px');
                    headingtape.css('transform', 'translateX(' + hdgticks + 'px');
                    gbox.textContent = gnumber + " G";

                    // set the skid-slip ball position
                    if (slipskid < -17) {
                        slipskid = -17;
                    }
                    else if (slipskid > 17) {
                        slipskid = 17;
                    }
                    var ballposition = ball_center + (slipskid * ball_offset);
                    ball.css('left', ballposition + 'px');
                });
        }, 50);
        
    }
    catch(error) {
        console.log(error);
    }
}