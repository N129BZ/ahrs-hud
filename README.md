# dynon-hud for Experimental Aircraft

## Heads Up Display for Dynon Efis using a Raspberry Pi and one of the multiple Dynon serial ports. The pi's HDMI video port is then used to display the Dynon ADHRS data on a Hudly or Kivic HUD. 

![Image of hud](https://github.com/N129BZ/dynon-hud/blob/master/docs/hud_in_bank.png)
## Instructions for a desktop (without extra software) install on the Raspberry Pi, using the minimum version of Buster. This has been tested on pi 2, pi 3b, and pi 3b+ NOTE: This does NOT require a Stratux. This requires a connection using 3 twisted pair wires from the selected Dynon serial port to the pi's GPIO pins.  (See GPIO picture under step 8 below.)

###### Raspberry Pi desktop installation instructions and download can be found at: https://www.raspberrypi.org/downloads/raspbian/

1. Run: **sudo apt install git** and then clone this repository to the home/pi folder

2. Install node v.11.15.0

3. Open the dynon-hud directory and run the following npm commands:
```bash
npm install minimist
npm install http
npm install express
npm install websocket
npm install serialport
npm install @serialport/parser-readline
```

4. Install all of the necessary raspbian packages:
```
sudo apt-get update       
sudo apt-get dist-upgrade
sudo apt install xorg
sudo apt install openbox
sudo apt install unclutter
sudo apt install --no-install-recommends chromium-browser
```

5. Create **pi@raspberrypi:~ $ .config/openbox/autostart** file and add the following commands. You may have to manually mkdir the **openbox** directory in the .config folder first.
```
# autostart file for launching the hud web page in a Chromium browser in kiosk mode

# Disable any form of screen saver / screen blanking / power management
xset s off
xset s noblank
xset -dpms

unclutter &

# Start Chromium in kiosk mode
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/'Local State'
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]\+"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences
chromium-browser --kiosk 'http://localhost/hud/hud.html' --disable-notifications --noerrdialogs --disable-infobars --incognito --no-first-run --disable-features=TranslateUI --disk-cache-dir=/dev/null
```

6. Create a bash file: **pi@raspberrypi:~ $ ~/.bash_profile** and add the **startx** command
```bash
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    startx
fi
```

7. Set the pi for desktop auto-login:
```
sudo raspi-config
select Boot Options
select Console Autologin, automatically logged in as ‘pi’ user
```
8. Connect the Ground wire from the Dynon serial port to pin 6, connect the RX wire to pin 8, and the TX wire to pin 10.
![Image of GPIO](https://github.com/N129BZ/dynon-hud/blob/master/docs/rpi-serial.png)

9. Connect the HUD to the HDMI port on the pi and reboot. When that is done, you should see the AHRS display.

###### NOTE:
If you need to tweak the view of the HUD screen, the div.hud class in css/hud.css can be edited at the setting transform: scale(x, y) to scale the 2 dimensions to your liking, or even rotate 180° if mounting the HUD from the top of the windscreen. It is suggested to not change values for masks and tapes, as they are calibrated by number of pixels to offset based on the speed, altitude, or heading values being applied.

![Image of ScaleSetting](https://github.com/N129BZ/dynon-hud/blob/master/docs/hudcss1.png)

![Image of ScaleSetting](https://github.com/N129BZ/dynon-hud/blob/master/docs/hudcss2.png)

![Image of UpsideDown](https://github.com/N129BZ/dynon-hud/blob/master/docs/hud_in_bank_ud.png)
