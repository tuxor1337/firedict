$(function() {
    var sidebar = "section[data-type=sidebar]",
        search_form = "form[role=search]",
        search_reset = "form[role=search] button[type=reset]",
        search_input = "form[role=search] input[type=text]",
        header = "section[role=region] header:first-child h1",
        header_toolbar = "header menu[type=toolbar]",
        output_area = "section[data-type=output]",
        list_section = "section[data-type=list]",
        progress = "p.loading";
    var last_search = "", progress_counter = 0,
        dict_list = [], oDictWorker = null,
        indexedDB_handle, IDB_transactions = {}, history;
    var MAX_DICTS = 20;
    
    var delay = (function(){
      var timer = 0;
      return function(callback, ms){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
      };
    })();
    
    function historyManager() {
        var db, ostore = "history", cache = [];
        function get_data(callbk) {
            db.transaction(ostore, "readwrite")
                .objectStore(ostore).get(0)
                .onsuccess = function (evt) {
                callbk(evt.target.result);
            };
        }
        
        function put_data(data) {
            db.transaction(ostore, "readwrite")
                .objectStore(ostore).put(data, 0);
        }
        
        this.print = function () {
            print_list(cache.concat().reverse());
        };
        this.add = function (entr) {
            for(var h=0; h < cache.length; h++) {
                if(cache[h][0] == entr[0]) {
                    var a = cache.splice(h, 1)[0][1].concat(entr[1]);
                    for(var i=0; i<a.length; ++i) {
                        for(var j=i+1; j<a.length; ++j) {
                            if(a[i][2] == a[j][2] && a[i][4] == a[j][4])
                                a.splice(j--, 1);
                        }
                    }
                    entr[1] = a;
                    break;
                }
            }
            cache.push(entr);
            put_data(cache);
        };
        this.clear = function () { cache = []; put_data([]); };
        this.load = function (db_handle) {
            db = db_handle;
            get_data(function (data) { cache = data; });
        };
    }
    history = new historyManager();
    
    var random_color = function () {
        var min = 0x33, max = 0xbb, result = "";
        for(var i = 0; i < 3; i++)
            result += (0x100+min + (max-min) * Math.random())
                .toString(16).substr(1,2);
        return result;
    };
    
    var log_to_screen = function (text) {
        $(output_area).append("<p>" + text + "</p>");
    };
    
    var split_path = function (path) {
        pos_slash = path.lastIndexOf('/');
        pos_dot = path.lastIndexOf('.');
        return [
            path.substring(0, pos_slash),
            path.substring(pos_slash+1),
            path.substring(pos_dot+1),
        ];
    };
    
    function DictWorker (sURL, fDefListener, fOnError) {
        var that = this, oWorker = new Worker(sURL), oListeners = {};
        this.defaultListener = fDefListener || function () {};
        
        oWorker.onmessage = function (oEvent) {
            if (oEvent.data instanceof Object
                && oEvent.data.hasOwnProperty("vo42t30")
                && oEvent.data.hasOwnProperty("rnb93qh"))
                oListeners[oEvent.data.vo42t30].apply(that, oEvent.data.rnb93qh);
            else that.defaultListener(oEvent.data);
        };
        
        if (fOnError) { oWorker.onerror = fOnError; }
        
        this.sendQuery = function () {
            if (arguments.length < 1) {
                throw new TypeError("QueryableWorker.sendQuery - not enough arguments");
                return; 
            }
            oWorker.postMessage({
                "bk4e1h0": arguments[0],
                "ktp3fm1": Array.prototype.slice.call(arguments, 1) 
            });
        };
        
        this.postMessage = function (vMsg) {
            Worker.prototype.postMessage.call(oWorker, vMsg);
        };
        
        this.terminate = function () {
            Worker.prototype.terminate.call(oWorker);
        };
        
        this.addListener = function (sName, fListener) {
            oListeners[sName] = fListener;
        };
        
        this.removeListener = function (sName) {
            delete oListeners[sName];
        };
    }
    
    var switch_mode = function (mode) {
        window.scrollTo(0,0);
        last_search="";
        $(output_area).hide();
        $(list_section).hide();
        $(progress).hide();
        $(header).hide();
        $(header_toolbar).hide();
        $(search_form).hide();
        if(mode == "manage") {
            $(header).text("Manage Dictionaries").show();
            $(header_toolbar).show();
            $(output_area).html("").show();
            for(var d = 0; d < dict_list.length; d++) display_dict(d);
            $(output_area).find("div.text").show();
        } else if(mode == "about") {
            $(output_area)
                .html("<h1>FireDict</h1><p>Copyright 2013 by tuxor1337</p>")
                .show();
            $(header).text("About FireDict").show();
        } else if(mode == "settings") {
            $(output_area).html("<h1>No settings yet.</h1>").show();
            $(header).text("About FireDict").show();
        } else if(mode == "lookup") {
            $(list_section).html("<ul />").show();
            $(output_area).html("").show();
            $(search_form).show();
            history.print();
        }
    };
    
    var display_dict = function (d) {
        $("<div />").addClass("text dict"+d).data("did",d)
            .append("<h2>" + dict_list[d].name + "</h2>")
            .css("border-color",dict_list[d].color)
            .appendTo(output_area).hide()
            .find("h2").css("background-color",dict_list[d].color);
    };
    
    var render_html_content = function (p, html, did) {
        dict = dict_list[did];
        $(p).append(html).attr("class","entry")
          .find("img").each(function () {
            var img_filename = $(this).attr("src")
                .replace(/^\x1E/, '').replace(/\x1F$/, '');
            var img_file = null;
            for(var r = 0; r < dict.res.length; r++) {
                var fname = dict.res[r].name;
                if(img_filename == fname.substring(
                    fname.lastIndexOf("/")+1
                )) {
                    img_file = dict.res[r]; break;
                }
            }
            if(img_file == null)
                console.log("File " + img_filename + " not found.");
            else {
                var reader = new FileReader();
                reader.onload = (function (theImgElement) {
                    return function (e) {
                        $(theImgElement).attr('src', e.target.result);
                    };
                })(this);
                reader.readAsDataURL(img_file);
            }
        });
        $(p).find("a").each(function () {
            linkText = $(this).text();
            linkRef = $(this).attr("href");
            if("bword://" != linkRef.substring(0,8)) {
                $(this).replaceWith(linkText);
            } else $(this).data("ref",linkRef.substring(8))
                        .attr("href","javascript:void(0)");
        });
    };
    
    var not_found = function () {
        $(list_section).find("ul")
            .html("<li><p>Nichts gefunden!</p></li>");
    };
    
    var print_list = function (matches) {
        $(list_section).html("<ul />").show();
        if(matches.length == 0) {
            not_found();
        } else {
            for(var m = 0; m < Math.min(matches.length, 20); m++) {
                var dlist = [];
                matches[m][1].forEach(function (match) {
                        var did = match[match.length-1]; 
                        if(dlist.indexOf(did) == -1)
                            dlist.push(did);
                });
                dlist.sort().reverse();
                p = $("<p />");
                dlist.forEach(function (d) {
                        $("<span />")
                            .css("background-color",dict_list[d].color)
                            .addClass("marker").appendTo(p);
                });
                $(p).append(matches[m][0]);
                $("<li />").data("entries", matches[m][1])
                    .append($("<a href=\"#\"></a>").append(p))
                    .appendTo($(list_section).find("ul"));
             }
        }
    };
    
    $(list_section).on("click", "a", function(evt) {
        entries = $(this).parents("li").data("entries");
        switch_mode("lookup");
        $(search_input).val($(this).text());
        $(list_section).html("<ul />").show();
        for(var d = 0; d < dict_list.length; d++) display_dict(d);
        entries.forEach(function (entr) {
            oDictWorker.sendQuery("get_entry", entr[entr.length-1], entr);
        });
    });
    
    $(search_input).on("keyup", function() {
        if(oDictWorker != null)
        delay(function() {
            var term = $(search_input).val();
            last = last_search;
            last_search = term;
            if(term == "") {
                switch_mode("lookup");
                return;
            } else if(term == last) return;
            
            $(output_area).html("").show();
            oDictWorker.sendQuery("lookup_fuzzy", term);
        }, 500);
    });
    
    $(search_form).on("mousedown", "button", function () {
        switch_mode("lookup");
        $(search_input).val("");
    });

    $(output_area).on("click", "div.text a", function (evt) {
        term = $(this).data("ref").trim();
        did = $(this).parents("div.text").data("did");
        switch_mode("lookup");
        $(search_input).val(term);
        $(list_section).html("<ul />").show();
        for(var d = 0; d < dict_list.length; d++) display_dict(d);
        oDictWorker.sendQuery("lookup_exact", did, term);
    });

    $(header_toolbar).on("click", "span.icon-reindex", function (evt) {
        if($(this).parent("a").attr("aria-disabled") != "true") {
            reindex_dictionaries();
        }
    });

    $(sidebar).on("click", "li", function (evt) {
        var id = $(this).attr("id");
        switch_mode(id);
        $(sidebar).find("li").removeClass("chosen").filter("#"+id).addClass("chosen");
    });
    
    oDictWorker = new DictWorker("/js/worker.js", function (data) {
        console.log(data);
    });
    
    oDictWorker.addListener("dbLoadEnd", function () {
        $(search_input).prop("disabled", false);
        $(progress).hide();
        $("section[role=region] > header > a").off('click')
            .on('click', function(e) { return true; });
        switch_mode("lookup");
    });
    
    oDictWorker.addListener("loadEnd", function (d, name, dbwordcount) {
        dict_list[d].name = name;
        dict_list[d].color = '#'+random_color();
        
        var tmp = 0;
        while(tmp < dict_list.length && dict_list[tmp].color != null) tmp++;
        if(tmp == dict_list.length) {
            function rec_add_dict(did) {
                if(did < dict_list.length) {
                    var data = {
                            "path": dict_list[did].path,
                            "base": dict_list[did].base,
                            // skip res and main
                            "color": dict_list[did].color,
                            "name": dict_list[did].name,
                            "files": dict_list[did].files,
                            // additional value dbwordcount
                            "dbwordcount": dbwordcount
                        };
                    console.log(data.name + " contains "
                        + data.dbwordcount + " entries.");
                    indexedDB_handle.transaction("dictionaries", "readwrite")
                        .objectStore("dictionaries").add(data, did)
                        .onsuccess = function(evt) {
                        rec_add_dict(did+1);
                    };
                } else {
                    switch_mode("manage");
                    $("section[role=region] > header > a").off('click')
                        .on('click', function(e) { return true; });
                    $("header > menu[type=toolbar] > a").attr("aria-disabled","false");
                }
            }
            rec_add_dict(0);
        } else {
            window.scrollTo(0,0);
            display_dict(d);
        }
        $(output_area).find("div.text").show();
    });
    
    oDictWorker.addListener("printList", function (matches) {
        if(dict_list.length > 1)
            matches.sort(function (a,b) {
                a = a[0].toLowerCase(), b = b[0].toLowerCase();
                if (a > b) return 1;
                if (a < b) return -1;
                return 0;
            });
        var tmp = [];
        while(matches.length > 0) {
            var m = matches.shift();
            var m_low = m[0].toLowerCase(), done = false;
            if(tmp.length == 0) tmp.push([m[0], []]);
            for(var i = tmp.length-1; i >= 0; i--) {
                if(m_low == tmp[i][0].toLowerCase()) {
                    tmp[i][1].push(m);
                    var tmptmp = tmp[i][1];
                    for(var j=0; j<tmptmp.length-1; j++) {
                        if(m[2] == tmptmp[j][2] && m[4] == tmptmp[j][4]) {
                            tmp[i][1].pop(); break;
                        }
                    }
                    if(m[0] == tmp[i][0]) done = true;
                } else {
                    if(!done) tmp.push([m[0], [m]]);
                    break;
                }
                if(i == 0 && !done) tmp.push([m[0], [m]]);
                
            }
        }
        for(var i = tmp.length-1; i >= 0; i--) {
            tmp[i][1].sort(function (a,b) {
                a = a[1].toLowerCase(), b = b[1].toLowerCase();
                if (a > b) return 1;
                if (a < b) return -1;
                return 0;
            });
        }
        print_list(tmp);
    });
    
    oDictWorker.addListener("printEntry", function (did, obj, data) {
        var term = $(search_input).val();
        if(data == null || data.length == 0) return;
        history.add([term, [obj]]);
        data.forEach(function (d) {
            p = $("<p />");
            if(d[1] == "m") $(p).append(document.createTextNode(d[0]));
            else if(d[1] == "h") render_html_content(p, d[0], did);
            
            if(term != obj[1]) syn = " <b>(Synonym: " + term + ")</b>";
            else syn = "";
            
            $(output_area).find("div.dict"+did)
                .append("<h3>" + obj[1] + syn + "</h3>")
                .append(p).show().find("h3")
                .css("background-color", dict_list[did].color);
        });
    });
    
    oDictWorker.addListener("progress", function (status, total) {
        $(progress).find("b").text("Worker's status: " + status + "/" + total);
    });
    
    oDictWorker.addListener("indexedDB", function (tid, action, did, data) {
        var idb_ostore = "dict" + did;
        if(action == "store_synonyms") {
            progress_counter = 0;
            var store = indexedDB_handle
                .transaction(idb_ostore, "readwrite")
                .objectStore(idb_ostore);
            function putNext(i) {
                if(i < data.length) {
                    store.add(data[i])
                        .onsuccess = function () { 
                        progress_counter += 1;
                        if(progress_counter % 967 == 0)
                            $(progress).find("b").text("Words in DB: " + progress_counter);
                        putNext(i+1); 
                    };
                } else {
                    oDictWorker.sendQuery("indexedDB", tid, null);
                }
            }
            putNext(0);
        } else if(action == "backup_idx") {
            idb_ostore = "idx" + did;
            progress_counter = 0;
            var index = data;
            var store = indexedDB_handle
                .transaction(idb_ostore, "readwrite")
                .objectStore(idb_ostore);
            function putNext(i) {
                if(i < index.length) {
                    store.add(index[i], i)
                        .onsuccess = function () { 
                        progress_counter += 1;
                        if(progress_counter % 967 == 0)
                            $(progress).find("b").text("Indices in DB: " + progress_counter);
                        putNext(i+1); 
                    };
                } else oDictWorker.sendQuery("indexedDB", tid, null);
            }
            putNext(0);
        } else if(action == "restore_idx") {
            idb_ostore = "idx" + did;
            var index = [];
            indexedDB_handle.transaction(idb_ostore)
                .objectStore(idb_ostore).openCursor()
                .onsuccess = function (event) {
                var cursor = event.target.result;
                if(!!cursor == false) 
                    oDictWorker.sendQuery("indexedDB", tid, index);
                else {
                    index.push(cursor.value);
                    cursor.continue()
                }
            };
        } else if(action == "get") {
            indexedDB_handle.transaction(idb_ostore)
                .objectStore(idb_ostore).get(data)
                .onsuccess = function(evt) {
                    oDictWorker.sendQuery(
                        "indexedDB", tid,
                        evt.target.result
                    );
            };
        } else if(action == "get_range") {
            var result = [];
            indexedDB_handle.transaction(idb_ostore)
                .objectStore(idb_ostore).openCursor(IDBKeyRange.lowerBound(data.start))
                .onsuccess = function (event) {
                var cursor = event.target.result;
                if(!!cursor == false || result.length > data.len) 
                    oDictWorker.sendQuery("indexedDB", tid, result);
                else {
                    result.push(cursor.value);
                    cursor.continue()
                }
            };
        }
    });

    function reindex_dictionaries() {
        console.log("reindexing dictionaries...");
        dict_list = []; history.clear(); progress_counter = 0; 
        switch_mode("manage");
        $(progress).show();
        $("section[role=region] > header > a").off('click')
            .on('click', function(e) { e.preventDefault(); return false; });
        $("header > menu[type=toolbar] > a").attr("aria-disabled","true");
        
        var sdcard = navigator.getDeviceStorage('sdcard');
        var ostores = ["dictionaries"];
        for(var i = 0; i < MAX_DICTS; i++) {
            ostores.push("dict"+i); ostores.push("idx"+i);
        }
        var trans = indexedDB_handle.transaction(ostores, "readwrite");
        
        function rec_clear (i) {
            if(i < ostores.length) {
                trans.objectStore(ostores[i]).clear()
                    .onsuccess = function () {
                    rec_clear(i+1);
                };
            } else scan_files();
        }
        
        function scan_files() {
            var request = sdcard.enumerate("dictdata");
            request.onsuccess = function () {
                if(!this.result) {
                    process_dicts();
                    return;
                }
                
                var file = this.result;
                if(null != file.name.match(/\.ifo$/)) {
                    var splitted = split_path(file.name),
                        dict = {
                            "path": splitted[0],
                            "base": splitted[1].replace(/\.ifo$/,""),
                            "res": [],
                            "main": [],
                            "color": null,
                            "name": null,
                            "files": []
                        };
                    dict_list.push(dict);
                }
                
                this.continue();
                return;
            };
        }
        
        function process_dicts() {
            var tmp = 0;
            dict_list.forEach(function (d) {
                var request = sdcard.enumerate(d.path);
                request.onsuccess = function () {
                    if(!this.result) {
                        tmp++; if(tmp == dict_list.length)
                            oDictWorker.sendQuery("load_dicts", dict_list);
                        return;
                    }
                    
                    var file = this.result,
                        patt = RegExp("^" + d.base + "\."),
                        splitted = split_path(file.name);
                    if(splitted[0] == d.path + "/res" && splitted[1] != "") {
                        d.res.push(file); d.files.push(file.name);
                    } else if(splitted[0] == d.path
                      && null != splitted[1].match(patt)) {
                        d.main.push(file); d.files.push(file.name);
                    }
                    request.continue();
                };
            });
        }
        
        console.log("clearing objectstores");
        rec_clear(0);
    }
    
    function load_idb_dictionaries() {
        console.log("loading dictionaries from db");
        $(search_input).prop("disabled", true);
        $(progress).show();
        $("section[role=region] > header > a").off('click')
            .on('click', function(e) { e.preventDefault(); return false; });
        
        dict_list = [];
        
        function rec_walk_dicts(d) {
            if(d < dict_list.length) {
                var dict = dict_list[d];
                function rec_get_files(i) {
                    if(i < dict.files.length) {
                        var sdcard = navigator.getDeviceStorage('sdcard');
                        sdcard.get(dict.files[i])
                            .onsuccess = function () {
                            var file = this.result;
                            var patt = RegExp("^" + dict.base + "\.");
                            var splitted = split_path(file.name);
                            if(splitted[0] == dict.path + "/res" && splitted[1] != "") {
                                dict.res.push(file);
                            } else if(splitted[0] == dict.path
                              && null != splitted[1].match(patt)) {
                                dict.main.push(file);
                            }
                            rec_get_files(i+1);
                        };
                    } else {
                        delete dict.files;
                        rec_walk_dicts(d+1);
                    }
                }
                rec_get_files(0);
            } else {
                oDictWorker.sendQuery("load_dicts_idb", dict_list);
            }
        }
        
        indexedDB_handle.transaction("dictionaries")
            .objectStore("dictionaries").openCursor()
            .onsuccess = function (event) {
            var cursor = event.target.result;
            if(!!cursor == false) rec_walk_dicts(0);
            else {
                var dict = cursor.value,
                    did = dict_list.length;
                dict.res = [];
                dict.main = [];
                dict_list.push(dict);
                for(var f = 0; f < dict.files.length; f++) {
                    if(null != dict.files[f].match(/\.ifo$/)) {
                        var splitted = split_path(dict.files[f]);
                        dict_list[did].path = splitted[0];
                        dict_list[did].base = splitted[1].replace(/\.ifo$/,"");
                        break;
                    }
                }
                cursor.continue();
            }
        };
    }
    
    $(sidebar).find("li#lookup").trigger("click");
    
    var request = indexedDB.open("FireDictDB");
    
    request.onerror = function (event) { 
       throw new Error("Why didn't you allow my web app to use IndexedDB?!");
    };
    
    request.onsuccess = function (event) {
        indexedDB_handle = request.result;
        indexedDB_handle.onerror = function (evt) {
            throw new Error("Database error: " + evt.target.errorCode);
        };
        history.load(indexedDB_handle);
        load_idb_dictionaries();
    };
    
    request.onupgradeneeded = function(event) {
        console.log("IDB upgraded");
        var db = event.currentTarget.result;
        db.createObjectStore("dictionaries");
        db.createObjectStore("history");
        for(var i = 0; i < MAX_DICTS; i++) {
            var objectStore = db.createObjectStore("idx"+i);
            var objectStore = db.createObjectStore(
                "dict"+i, { keyPath: "id", autoIncrement: false }
            );
        }
    };
});
