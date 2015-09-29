﻿# image-grid

A simple image-grid for displaying images like this

<img src="images/screenshot-01.jpg" />

Effectively the same as tumblr's archive view.

Nearly all processing happens in the browser. A simple node server gets a list of
images from one or more folder trees. It then serves those images and a simple viewer.

The viewer reads the list of images and then proceeds to download each one, generate
a thumbnail and place the thumbnails in columns.

Click an image to see it larger. Click again to close.

Videos are also supported.

**Note:** This system is meant to display files on your local machine for you to browse your
own images. It is not meant to publically serve images. If that's what you want you
would want to generate thumbnails on the server so you can send the smallest amount of
data possible. This on other hand always sends the full res images to the browser and
the browser makes thumbnails.

It was just the quickest way of getting an image browser in the format I wanted.

## Installing

1.  Install node.js [from here](http://nodejs.org/en/download/).
2.  Download or clone this repo.
3.  cd to the repo and type `npm install`

## Running

type

    node index.js path/to/images

Then open a browser and go to `http://localhost:8080`

**Note:** you can pass multiple paths

    node index.js path/to/images path/to/more/images path/to/yet/more/images

## Usage

*   Click an image to view it.
*   Click again to close.
*   Click on left of window to go to previous image (or press ⇦)
*   Click on right of window to go to next image (or press ⇨)
*   Click on stretch icon to cycle between

    <img src="public/images/stretch-both.svg" width="32" />
    stretch to fit in both dimensions

    <img src="public/images/stretch-none.svg" width="32" />
    show in original size

    <img src="public/images/stretch-horizontal.svg" width="32" />
    stretch to fit width

    <img src="public/images/stretch-vertical.svg" width="32" />
    stretch to fit height

*   Click on rotate icon to rotate in increments of 90 degrees

    <img src="public/images/rotate.svg" width="32"

## Settings

Viewer settings can be set in the URL by adding `?setting=value&setting=value`. For example
`http://localhost:8080?columnWidth=300` will make the columns 300 pixels wide instead of the default 160.

### `columnWidth`

the width of a column in css pixels. The default is 160

### `minSize`

any image below this size is not displayed. The default is 256. Note gifs ignore this rule

### `padding`

amount of padding to put between images. The default is 10.


## License

MIT


