# adahrs-hud for Experimental Aircraft

## Heads Up Display for Garmin or Dynon EFIS's using a Raspberry Pi Zero and one of the multiple EFIS serial ports. The pi's HDMI video port is then used to display the ADAHRS data on a Hudly or Kivic HUD. 
![Image of hud](https://github.com/N129BZ/adahrs-hud/blob/master/docs/Screenshot20200418.png)

# UNDER CONSTRUCTION...
## Instructions for an installation of Buster Lite on the Raspberry Pi. 

###### NOTE:
If you need to tweak the view of the HUD screen, the div.hud class in css/hud.css can be edited at the setting transform: scale(x, y) to scale the 2 dimensions to your liking, or even rotate 180° if mounting the HUD from the top of the windscreen. It is suggested to not change values for masks and tapes, as they are calibrated by number of pixels to offset based on the speed, altitude, or heading values being applied.

![Image of ScaleSetting](https://github.com/N129BZ/adahrs-hud/blob/master/docs/hudcss1.png)

![Image of ScaleSetting](https://github.com/N129BZ/adahrs-hud/blob/master/docs/hudcss2.png)

![Image of UpsideDown](https://github.com/N129BZ/adahrs-hud/blob/master/docs/Screenshot20200418_ud.png)
