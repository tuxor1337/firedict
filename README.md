firedict
========

A simple offline dictionary software for Firefox OS

This project is put on ice till late February 2014! Please contact me if you have plans to work on it in the meantime. Major restructuring plans are already on paper and I might have to think these plans over if somebody comes up with great new ideas.
---

There are still major problems with the way dictionaries are stored
internally.

1. First attempt: load all the word lists into RAM using simple arrays for
the word index and all the synonyms. This was very slow at looking up terms.

2. Use more complex data structures, like a variant of binary trees.
Since we aim at alphabetically sorted word lists and since we want to perform
fuzzy lookups with alphabetically sorted results, this is certainly the
best choice. Many dictionary apps use this data structure for lookup. 

3. IndexedDB: The binary trees get huge pretty quickly, so we don't want to
keep them in memory, but need a different place to store them. For a Firefox
OS app there is no choice: we have to use the IndexedDB API.

4. Web workers: In order to keep our app nice and responsive, I decided to
put all the complicated lookup stuff in a second thread. (Otherwise, initial
indexing will render our app unresponsive for minutes.) With JavaScript this
means using web workers.

5. Tradeoff: Unfortunately, there is no IndexedDB API inside of web workers.
So the database transactions have to be done in the main thread. This fact
in combination with the complex tree structure renders writing the tree
structure into the database very, very slow.

6. Back to arrays: For the moment, a much faster way is doing all the indexing
in memory using simple arrays and then writing everything to the IndexedDB
at once. We stick to the binary structure by using binary insert and binary
search which boosts performance significantly.

7. Too damn slow: While everything does work like this, the overall
experience becomes painfully slow once we have dictionaries with a total
number of over a million words: Indexing takes minutes (which would be
okay, since it's done only once) and a single word lookup takes over a
second. Like this firedict can't possibly keep up with any dictionary app
out there.

8. Last modifications brought a slight improvement in performance. But still,
the UI doesn't feel smooth enough (word lookup should be significantly
faster).

![screenshot0](https://raw.github.com/tuxor1337/firedict/master/screen0.png "drawer") # 
![screenshot1](https://raw.github.com/tuxor1337/firedict/master/screen1.png "list of matches")

![screenshot2](https://raw.github.com/tuxor1337/firedict/master/screen2.png "displaying an entry") #
![screenshot3](https://raw.github.com/tuxor1337/firedict/master/screen3.png "managing dictionaries")

![screenshot4](https://raw.github.com/tuxor1337/firedict/master/screen4.png "indexing dictionaries")
