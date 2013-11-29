firedict
========

A simple offline dictionary software for Firefox OS

Please note, that it's kind of experimental at the moment. Dictionaries are read in from the sdcard at every single startup and there is no way to "deactivate" or ignore single dictionaries. But once the basic functionality (see below) is there, I will add these features step by step.

An even more serious issue at the moment is the memory constraint that firefox os seems to impose on web workers. Because of this, the app can only handle some 4000 entries of a dictionary at the moment: https://groups.google.com/forum/#!forum/mozilla.dev.developer-tools

![screenshot0](https://raw.github.com/tuxor1337/firedict/master/screen0.png "home screen") # 
![screenshot1](https://raw.github.com/tuxor1337/firedict/master/screen1.png "list of matches")

![screenshot2](https://raw.github.com/tuxor1337/firedict/master/screen2.png "typing a term") #
![screenshot3](https://raw.github.com/tuxor1337/firedict/master/screen3.png "displaying an entry")
