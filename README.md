# dynon-hud for Experimental Aircraft

## Heads Up Display for Dynon Efis using a Raspberry Pi and one of the multiple Dynon serial ports. The pi's HDMI video port is then used to display the Dynon ADHRS data on a Hudly or Kivic HUD. 

![Image of hud](https://github.com/N129BZ/dynon-hud/blob/master/docs/hud_in_bank.png)
## Instructions for an installation of Buster Lite on the Raspberry Pi. This has been tested on pi 2, pi 3b, and pi 3b+ NOTE: This does NOT require a Stratux. This requires a connection using 3 twisted pair wires from the selected Dynon serial port to the pi's GPIO pins.  (See GPIO picture under step 8 below.)

###### Raspberry Pi Buster Lite installation instructions and download can be found at: https://www.raspberrypi.org/downloads/raspbian/

1. After installing Buster, open the **raspi-config** configuration app:
```
sudo raspi-config
```
From the menu select:
```
Boot Options
Desktop CLI
Console Autologin
```  
Tab to OK and enter, after the menu comes back up select:
```
Advanced Options
Overscan
```
Tab to OK and press enter. Press the tab key twice to get to the **Finish** option, then press enter. When asked to reboot, select Yes.

2. Open a terminal and run: **sudo apt install git** 

3. Then clone this repository to the home/pi folder:
```
git clone https://github.com/N129BZ/dynon-hud.git
```

4. Install node using this Node Red install script:
```
bash <(curl -sL https://raw.githubusercontent.com/node-red/linux-installers/master/deb/update-nodejs-and-nodered)
```

5. Change the directory: **pi@raspberrypi:~$ cd dynon-hud** and then run the following npm commands:
```bash
npm install minimist
npm install http
npm install express
npm install websocket
npm install serialport
npm install @serialport/parser-readline
```

6. Change the directory to: **pi@raspberrypi:~/dynon-hud$ cd** and then run the following command:
```
sudo npm install pm2@latest -g
```

7. Install all of the necessary raspbian packages, execute these two commands:
```
sudo apt-get install --no-install-recommends xserver-xorg x11-xserver-utils xinit openbox

sudo apt install --no-install-recommends chromium-browser
```

8. Open this file for editing: **pi@raspberrypi:~ $ sudo nano /etc/xdg/openbox/autostart** and add the following commands. 
```
# Launch the server process, which opens serial port, etc.
pm2 start /home/pi/dynon-hud/index.js

# Disable any form of screen saver / screen blanking / power management
xset s off
xset s noblank
xset -dpms

sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/'Local State'
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]\+"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences

# Run Chromium in kiosk mode
chromium-browser  --noerrdialogs --disable-infobars --kiosk $KIOSK_URL
```

9. Edit the Openbox environment file:
```
sudo nano /etc/xdg/openbox/environment 
```

10. Cursor to the bottom and enter the KIOSK_URL environment variable:
```
export KIOSK_URL=https://localhost:8686
```

11. Set the pi to start the XServer on bootup:
```
See if ~/.bash_profile already exists:
ls -la ~/.bash_profile

If NOT, then create an empty file:
touch ~/.bash_profile

Finally, edit the ~/.bash_profile file:
sudo nano ~/.bash_profile

Add this line to start the X server on boot. Because I am using a touch screen I’m passing in the flag to remove the cursor.

[[ -z $DISPLAY && $XDG_VTNR -eq 1 ]] && startx -- -nocursor
```

12. Reboot.

13. Connect the Ground wire from the Dynon serial port to pin 6, connect the RX wire to pin 8, and the TX wire to pin 10.
![Image of GPIO](https://github.com/N129BZ/dynon-hud/blob/master/docs/rpi-serial.png)

14. Connect the HUD to the HDMI port on the pi and reboot. When that is done, you should see the AHRS display.

###### NOTE:
If you need to tweak the view of the HUD screen, the div.hud class in css/hud.css can be edited at the setting transform: scale(x, y) to scale the 2 dimensions to your liking, or even rotate 180° if mounting the HUD from the top of the windscreen. It is suggested to not change values for masks and tapes, as they are calibrated by number of pixels to offset based on the speed, altitude, or heading values being applied.

![Image of ScaleSetting](https://github.com/N129BZ/dynon-hud/blob/master/docs/hudcss1.png)

![Image of ScaleSetting](https://github.com/N129BZ/dynon-hud/blob/master/docs/hudcss2.png)

![Image of UpsideDown](https://github.com/N129BZ/dynon-hud/blob/master/docs/hud_in_bank_ud.png)
