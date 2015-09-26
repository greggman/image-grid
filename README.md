# image-grid

A simple image-grid for displaying images like this

<img src="images/screenshot-01.jpg" width="50%" />

Nearly all processing happens in the browser. A simple node server gets a list of
images from 1 or more folder trees. It then serves those images and a simple viewer.

The viewer reads the list of images and then proceeds to download each one, generate
a thumbnail an place the thumbnails in columns.

Note: This system is meant to display files on your local machine for you to browse your
own images. It is not meant to publically serve images. If that's what you want you
would want to generate thumbnail on the server so you can send the smallest amount of
data possible. This on other hand always ends the full res images to the browser and
the browser makes thumbmails.

It was just the quickest way of getting an image browser in the format I wanted.


