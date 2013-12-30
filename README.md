firedict
========

A simple offline dictionary software for Firefox OS

There are still major problems with the way dictionaries are stored
internally.

Our first attempt was to load all the word lists into RAM using
simple arrays for the word index and all the synonyms. But this was very
slow at looking up terms.

The next logical step was to use more complex data structures: a variant
of binary trees.
Since we aim at alphabetically sorted word lists and since we want to perform
fuzzy lookups with alphabetically sorted results, this is certainly the
best choice. Many dictionary apps use this data structure for lookup. 

The binary trees get huge pretty quickly, so we don't want to keep them in
memory, but need a different place to store them. For a Firefox OS app
there is no choice: we have to use the IndexedDB API.

In order to keep our app nice and responsive, I decided to put all the 
complicated lookup stuff in a web worker (~multi-threading). 
Otherwise, initial indexing will render our app unresponsive for minutes.

Unfortunately, there is no IndexedDB API inside of web workers. So the
database transactions have to be done in the main thread.
This renders writing the tree structure into the database very, very slow...
and this is what I'm working on at the moment.

![screenshot0](https://raw.github.com/tuxor1337/firedict/master/screen0.png "drawer") # 
![screenshot1](https://raw.github.com/tuxor1337/firedict/master/screen1.png "list of matches")

![screenshot2](https://raw.github.com/tuxor1337/firedict/master/screen2.png "displaying an entry") #
![screenshot3](https://raw.github.com/tuxor1337/firedict/master/screen3.png "managing dictionaries")
