
/////////////////////////////////////////////////////////////////////
// Node.js serialport implementation - raise the parser.data event 
// when data comes in from the Dynon ADAHRS serial port
///////////////////////////////////////////////////////////////////// 

const host = "ws://" + location.hostname + ":9696";
const websock = new WebSocket(host);

websock.onopen = openSocket;
websock.onmessage = onSerialData;

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
    e.data = "!1121144703-085-03003310146+04736+003-03+1013-033+110152245+01650023176C"
    onSerialData(e);
});

var speedtape = $('#speedtape');
var alttape = $('#alttape');
var headingtape = $('#headingtape');
var ball = $('#ball');
var attitude = $.attitudeIndicator('#attitude', 'attitude', {roll:50, pitch:-20, size:600, showBox : true});

// offsets, in pixels per unit of measure
const spd_offset = 4.8;    // Knots
const alt_offset = .4792;  // Feet MSL
const hdg_offset = 4.720;  // Degrees
const ball_offset = 3;     // Degrees
const ball_center = 433;   // this is "center" of the slip-skid indicator
const pitch_offset = 1.19; // this adjusts the pitch to match Stratux

var speedbox = document.getElementById('tspanSpeed');
var altitudebox = document.getElementById('tspanAltitude');
var headingbox = document.getElementById('tspanHeading');
var gbox = document.getElementById('tspanGMeter');
var vspeedbox = document.getElementById('tspanVertSpeed');
var arrowbox = document.getElementById('tspanArrow');
var tas = document.getElementById("tspanTAS");
var oat = document.getElementById("tspanOAT");
var dalt = document.getElementById("tspanDalt");

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}


function onSerialData(e) {

    //////////////////////////////////////////////////////////////////////////////
    // Extract data from Dynon serial data stream (string)
    //---------------------------------------------------------------------------
    // example data:
    // !1121144703-014+00003310811+01736+003-03+1013-033+110831245+01650023176C
    //////////////////////////////////////////////////////////////////////////////
    var str = new String(e.data);
    var roll = (parseInt(str.substr(15,5))/10);
    var pitch = (parseInt(str.substr(11,4))/10);
    var gLoad = (parseInt(str.substr(40,3))/10);
    var slipskid = (parseInt(str.substr(37,3)));
    var altitude = parseInt(str.substr(27,6));
    var heading = parseInt(str.substr(20,3));
    var airspeed = parseInt(str.substr(23,4));
    var vertspeed = (parseInt(str.substr(45,4))*10);
    var OAT = str.substr(49,3);
    var TAS = parseInt(str.substr(52,4));
    var baro = parseInt(str.substr(56,3));
    var dAlt = parseInt(str.substr(59,6));

    attitude.setRoll(roll * -1);
    attitude.setPitch(pitch * pitch_offset);

    // set these values to a reasonable precision
    gnumber = gLoad.toFixed(1);
    slipskid = Math.trunc(slipskid);

    speedbox.textContent = airspeed;
    altitudebox.textContent = altitude;
    headingbox.textContent = heading;
    vspeedbox.textContent = Math.abs(vertspeed) + " fpm";
    arrowbox.textContent = (vertspeed < 0 ? "▼" : "▲");
    oat.textContent = "oat " + OAT + " c";
    tas.textContent = "tas " + TAS + " kt";
	dalt.textContent = "d  alt " + dAlt + " ft";
	
    var speedticks = (airspeed * spd_offset);
    var altticks = (altitude * alt_offset);
    var hdgticks = (heading * hdg_offset) * -1;

    // set the coordinates of the tapes
    speedtape.css('transform', 'translateY(' + speedticks + 'px)');
    alttape.css('transform', 'translateY(' + altticks + 'px');
    headingtape.css('transform', 'translateX('+ hdgticks + 'px');

    gbox.textContent = `${gnumber} g`;

    // set the skid-slip ball position
    if (slipskid < -17) {
        slipskid = -17;
    }
    else if (slipskid > 17) {
        slipskid = 17;
    }
    var ballposition = ball_center + (slipskid * ball_offset);
    //console.log("slipskid: " + slipskid + ", ball position: " + ballposition)
    ball.css('left', ballposition + 'px');
}
