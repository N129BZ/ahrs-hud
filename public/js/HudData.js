'use strict';
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
        this.oatF = Math.ceil(parseInt(this.str.substr(49, 3)) * 1.8 + 32);
        this.oatC = parseInt(this.str.substr(49, 3));

        if (this.client == "dynon") { // Dynon furnishes these extra fields
            this.tas = Math.trunc(parseInt(this.str.substr(52, 4)) / 10);
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

        var baltfactor = pafactor * (29.92 - this.baropressure);
        this.baltitude = round10(this.altitude + baltfactor);
    }
}
