# ahrs-hud - Heads Up Display uses Dynon, Garmin, or Stratux AHRS data, all with Stratux Traffic Warnings, for Experimental Aircraft

## This HUD can use Dynon or Garmin serial port AHRS data, or Stratux WiFi AHRS data, using a Raspberry Pi. The pi's HDMI video port is then used to display the AHRS on a Hudly or Kivic HUD. 
![Image of hud](https://github.com/N129BZ/adahrs-hud/blob/master/docs/Screenshot20200418.png)

## To install: 
    1. Install the latest version of node.js that supports your processor - for example, Pi Zero W uses an armv6l, Pi 3b uses an armv7l  
    2. Unzip the app to a folder named "ahrs-hud"
    3. Go to a terminal in the ahrs-hud folder and do "npm install" which will add the required Node modules.
    4. Start the app by executing "node index.js" in the terminal.
    5. Navigate your browser to localhost:8080 and the HUD Setup page will be displayed. Enter the desired parameters and save.
    6. After saving the setup values, the HUD will be displayed. 
    7. It is highly recommended to install and use node pm2 to setup an automatic startup daemon of index.js 

###### NOTE:
If you need to tweak the view of the HUD screen, the div.hud class in css/hud.css can be edited at the setting transform: scale(x, y) to scale the 2 dimensions to your liking, or even rotate 180° if mounting the HUD from the top of the windscreen. It is suggested to not change values for masks and tapes, as they are calibrated by number of pixels to offset based on the speed, altitude, or heading values being applied.

![Image of ScaleSetting](https://github.com/N129BZ/adahrs-hud/blob/master/docs/hudcss1.png)

![Image of ScaleSetting](https://github.com/N129BZ/adahrs-hud/blob/master/docs/hudcss2.png)

![Image of UpsideDown](https://github.com/N129BZ/adahrs-hud/blob/master/docs/Screenshot20200418_ud.png)
