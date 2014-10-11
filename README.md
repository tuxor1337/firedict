firedict
========

A simple offline dictionary software for Firefox OS

![screenshot0](https://raw.github.com/tuxor1337/firedict/master/screen0.png "drawer") # 
![screenshot1](https://raw.github.com/tuxor1337/firedict/master/screen1.png "list of matches")

![screenshot2](https://raw.github.com/tuxor1337/firedict/master/screen2.png "displaying an entry") #
![screenshot3](https://raw.github.com/tuxor1337/firedict/master/screen3.png "managing dictionaries")

![screenshot4](https://raw.github.com/tuxor1337/firedict/master/screen4.png "changing a dictionary's color") #
![screenshot4](https://raw.github.com/tuxor1337/firedict/master/screen5.png "moving dictionaries around")

localization
------------

The languages, currently supported by Firedict, with their respective
translators are as follows:

* English, German - tuxor1337
* Russian - Svetlana A. Tkachenko
* French - anonymous contributor

If you are interested in contributing to the localization of FireDict, have a
look at the localizable strings in `locales/firedict.en-US.properties` and feel
free to send a pull request.

testing the ui
--------------

Replace `js/worker.js` by `test/worker.js` in order to get rid of the requirements
for privileges and permissions. Using the test-worker you can run the app in
any browser (mobile or non-mobile, offline or online) and test all the ui stuff
like i10n.js, AngularJS, jQuery and stylesheets. (The test worker uses dummy
dictionaries and dummy lookups etc.)

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
along with FireDict (see `COPYING`).  If not, see <http://www.gnu.org/licenses/>.

However, FireDict is heavily based on third-party code that is listed in
`LICENSE.3rd-party` along with its corresponding authors and licenses.
