
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
    e.data = "!1121144703-085-03003550146+04736+003-03+1013-033+110138245+01650023176C"
    onSerialData(e);
});

var speedtape = $('#speedtape');
var alttape = $('#alttape');
var headingtape = $('#headingtape');
var ball = $('#ball');
var attitude = $.attitudeIndicator('#attitude', 'attitude', {roll:50, pitch:-20, size:600, showBox : true});

// offsets, in pixels per unit of measure
const spd_offset = 4.8;    // Knots
const alt_offset = .4792   // .1249;  // Feet MSL
const hdg_offset = 4.793;  // Degrees
const ball_offset = -4;    // Degrees
const ball_center = 53.5;  // this is "center" of the slip-skid indicator
const pitch_offset = 1.19; // this adjusts the pitch to match Stratux

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

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}


//////////////////////////////////////////////////////////////////////////////
  // Extract data from Dynon serial data stream (string)
  //---------------------------------------------------------------------------
  // example data:
  // !1121144703-014+00003310811+01736+003-03+1013-033+110831245+01650023176C
  //////////////////////////////////////////////////////////////////////////////
function onSerialData(e) {
    var str = new String(e.data);
    var roll = (parseInt(str.substr(15,5))/10);
    var pitch = (parseInt(str.substr(11,4))/10);
    var gLoad = (parseInt(str.substr(40,3))/10);
    var slipskid = (parseInt(str.substr(37,3)));
    var altitude = parseInt(str.substr(27,6));
    var heading = parseInt(str.substr(20,3));
    var airspeed = parseInt(str.substr(23,4));
    var vertspeed = (parseInt(str.substr(45,4))*10);
    var oat = str.substr(49,3);
    var tas = parseInt(str.substr(52,4));
    var baro = parseInt(str.substr(56,3));
    var dalt = parseInt(str.substr(59,6));
    var winddirection = parseInt(str.substr(65,3));
    var windkts = parseInt(str.substr(68,2));

    attitude.setRoll(roll * -1);
    attitude.setPitch(pitch * pitch_offset);

    // set these values to a reasonable precision
    gnumber = gLoad.toFixed(1);
    slipskid = Math.trunc(slipskid);
    strdalt = dalt >= 0 ? "+" + dalt : "-" + dalt;
    var baropressure = (baro / 100) + 27.5;

    speedbox.textContent = airspeed;
    altitudebox.textContent = altitude;
    headingbox.textContent = heading;
    vspeedbox.textContent = Math.abs(vertspeed) + " fpm";
    barobox.textContent = "BpHg " + baropressure;
    arrowbox.textContent = vertspeed < 0 ? "▼" : "▲";
    oatbox.textContent = "OAT " + oat;
    tasbox.textContent = "TAS " + tas + " kt";
    daltbox.textContent = "DAlt " + strdalt;
    windspeed.textContent =  windkts + " kt"

    var speedticks = (airspeed * spd_offset);
    var altticks = (altitude * alt_offset);
    var hdgticks = (heading * hdg_offset) * -1;

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
    //console.log("slipskid: " + slipskid + ", ball position: " + ballposition)
    ball.css('left', ballposition + 'px');
  
    // set the wind speed & direction
    // fix for backwards arrow 
    if (winddirection < 180) {
        winddirection += 180;
    }
    else {
        winddirection -= 180; 
    } 
    windarrow.style.transform  = 'rotate('+ winddirection +'deg)';
}
