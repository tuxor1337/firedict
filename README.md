FireDict
========

A simple offline dictionary software for Firefox OS and Firefox for Android.

Currently, only StarDict dictionaries are supported.
Users can organize many dictionaries by renaming, coloring,
reordering them and by classifying them in groups.
The last 20 terms that have been looked up are stored and can be accessed
directly from the start screen.

The user interface can be customized.
Users can change the font size of dictionary entries or force all dictionary
colors to be greyscale.
Furthermore, long entries can be truncated by default.

Screenshots
-----------

Screenshots are hosted on tovotu.de and displayed on the marketplace as well as
on [the project's homepage](http://tuxor1337.frama.io/firedict/).

![screenshot1](http://tovotu.de/data/firedict/screenshots/latest/screen1.png "list of matches") #
![screenshot2](http://tovotu.de/data/firedict/screenshots/latest/screen2.png "displaying an entry")

Localization
------------

The languages, currently supported by Firedict, with their respective
translators are as follows:

* English, German - tuxor1337
* Russian - Svetlana A. Tkachenko
* Czech - Jan Knížek
* French - Luc Absil
* Italian, Spanish - anonymous contributors

If you are interested in contributing to the localization of FireDict, have a
look at the localizable strings in `src/locales/firedict.en-US.properties` and feel
free to send a pull request.

Build and run
-------------

The build process requires the Node package manager `npm`. Apart from that you
just have to run `make` in order to get a fully working version of FireDict in
`build/livebuild` (simply open in WebIDE as packaged app). The file `build/package.zip`
is the one that is uploaded to the Firefox Marketplace.

Furthermore, `make` creates a version of this app that doesn't require
privileges and permissions. You can run it by opening
`build/testbuild/index.html` in any browser (mobile or non-mobile, offline or
online) and test all the ui stuff like l10n.js, AngularJS and stylesheets. (The
test worker uses dummy dictionaries and dummy lookups etc.)

Licensing and third-party code
----------------

FireDict is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

FireDict is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with FireDict (see [COPYING.txt](COPYING.txt)).
If not, see [gnu.org/licenses/](https://www.gnu.org/licenses/).

However, FireDict is heavily based on third-party code that is listed in
[LICENSE.3rd-party](LICENSE.3rd-party) along with its corresponding authors and licenses.
