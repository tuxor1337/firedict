
function DictWorker(sURL, fDefListener, fOnError) {
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

var delay = (function(){
  var timer = 0;
  return function(callback, ms){
    clearTimeout (timer);
    timer = setTimeout(callback, ms);
  };
})();
    
$(function() {
    var indexedDB_handle, oDictWorker, dbName = "FireDictDB",
        aDicts = [], last_search = "", aResources = [];
    
    var sidebar = "section[data-type=sidebar]",
        search_form = "form[role=search]",
        search_reset = "form[role=search] button[type=reset]",
        search_input = "form[role=search] input[type=text]",
        header = "section[role=region] header:first-child h1",
        header_toolbar = "header menu[type=toolbar]",
        output_area = "section[data-type=output]",
        list_section = "section[data-type=list]",
        progress = "section[data-type=progressbar]",
        progress_text = "section[data-type=progressbar] p",
        progress_bar = "section[data-type=progressbar] progress";
    
    
    function dict_by_id(version) {
        var result = null;
        aDicts.forEach(function (d) {
            if(d.version == version) result = d;
        });
        return result;
    }
    
    function edit_dictionary(version, key, value) {
    }
    
    function print_progress(status, total, text) {
        if(typeof total === "undefined") total = 0;
        if(typeof text === "undefined") text = "";
        if(text !== true) $(progress_text).text(text);
        if(total == 0)
            $(progress_bar).removeAttr("value").removeAttr("max");
        else $(progress_bar).attr("value", status)
                .attr("max", total);
        $(progress).show();
    }
    
    function switch_mode(mode) {
        window.scrollTo(0,0);
        last_search = "";
        $(output_area).hide();
        $(list_section).hide();
        $(progress).hide();
        $(header).hide();
        $(header_toolbar).hide();
        $(search_form).hide();
        if(mode == "manage") {
            $(header).text("Manage Dictionaries").show();
            $(header_toolbar).show();
            $(list_section).html("<ul />").show();
            for(var d = 0; d < aDicts.length; d++) {
                var dict = aDicts[d],
                    li = $("<li />").appendTo($(list_section).find("ul"));
                $(li).addClass("sortable")
                .data("did", dict.version)
                .append(
                    $("<div />").css("border-color", dict.color)
                    .css("background-color", dict.color)
                    .addClass("color")
                )
                .append($("<p />").text(dict.alias))
                .append(
                    $("<div />").addClass("buttons")
                    .append("<button>Color...</button>")
                    .append("<button>Rename...</button>")
                );
                if(!dict.active)
                    $(li).addClass("inactive");
            }
        } else if(mode == "about") {
            $(output_area)
            .html("<p>Open source offline dictionary webapp for StarDict dictionaries hosted on GitHub</p>")
            .append("<p>https://github.com/tuxor1337/firedict</p>")
            .append("<p>Scans for dictionaries in your sdcard's \"dictdata\" directory.</p>")
            .show();
            $(header).text("About FireDict").show();
        } else if(mode == "settings") {
            $(header).text("Settings").show();
            $(list_section).html("<ul />").show();
            $("<li />").addClass("settings")
            .append("<a href=\"#\"><p>Clear history</p></a>")
            .appendTo($(list_section).find("ul"));
        } else if(mode == "lookup") {
            $(list_section).html("<ul />").show();
            $(search_form).show();
            $(search_input).val("");
            oDictWorker.sendQuery("history");
        } else if(mode == "lookup_entry") {
            $(output_area).html("").show();
            $(search_form).show();
            for(var d = 0; d < aDicts.length; d++) {
                var dict = aDicts[d];
                $("<div />").addClass("text dict"+dict.version)
                    .data("did", dict.version)
                    .append("<h2>" + dict.alias + "</h2>")
                    .css("border-color",dict.color)
                    .appendTo(output_area).hide()
                    .find("h2").css("background-color",dict.color);
            }
        }
    }
    
    function init() {
        var startup = true;
        
        $(sidebar).on("click", "li", function (evt) {
            var id = $(this).attr("id");
            switch_mode(id);
            $(sidebar).find("li").removeClass("chosen")
                .filter("#"+id).addClass("chosen");
        });
        
        $(search_input).on("keyup", function() {
            if(oDictWorker != null)
                delay(function() {
                    var term = $(search_input).val(),
                        last = last_search;
                    last_search = term;
                    if(term == "") switch_mode("lookup");
                    else if(term != last) {
                        $(output_area).html("").show();
                        oDictWorker.sendQuery("lookup_fuzzy", term);
                    }
                }, 400);
        });
        
        $(search_form).on("mousedown", "button", function () {
            switch_mode("lookup");
            $(search_input).val("");
        });
        
        $(list_section).on("click", "a.term", function(evt) {
            var entries = $(this).parents("li").data("entries");
            $(search_input).val($(this).text());
            switch_mode("lookup_entry");
            entries.forEach(function (entr) {
                oDictWorker.sendQuery("get_entry", entr);
            });
        });
        
        $(list_section).on("click", "li.settings a", function(evt) {
            if (window.confirm("Do you really want clear your history?")) { 
                oDictWorker.sendQuery("clear_history");
            }
        });
        
        $(list_section).on("click", "li.sortable div.color", function(evt) {
            var parent_li = $(this).parents("li"),
                did = $(parent_li).toggleClass("inactive").data("did"),
                dict = dict_by_id(did);
            dict.active = !$(parent_li).hasClass("inactive");
            oDictWorker.sendQuery("edit_dictionary", dict);
        });
        
        $(list_section).on("click", "li.sortable button", function(evt) {
            var did = $(this).parents("li").data("did"),
                dict = dict_by_id(did);
            if($(this).text() == "Rename...") {
                var result = window.prompt("Type in a new name",  dict.alias);
                if(result != "" && result != null) {
                    dict.alias = result;
                    oDictWorker.sendQuery("edit_dictionary", dict);
                    $(this).parents("li").find("p").text(result);
                }
            }
        });
        
        $(list_section).on("click", "li.sortable p", function(evt) {
            var parent_li = $(this).parents("li");
            if(!$(parent_li).hasClass("selected")) {
                $(parent_li).siblings("li").removeClass("selected");
            }
            $(parent_li).toggleClass("selected");
        });
        
        $(output_area).on("click", "div.text a", function (evt) {
            var term = $(this).data("ref").trim(),
                did = $(this).parents("div.text").data("did");
            $(search_input).val(term);
            switch_mode("lookup_entry");
            oDictWorker.sendQuery("lookup_exact", did, term);
        });
        
        $(header_toolbar).on("click", "span.icon-reindex", function (evt) {
            if($(this).parent("a").attr("aria-disabled") != "true") {
                print_progress();
                oDictWorker.sendQuery("init");
            }
        });
        
        oDictWorker = new DictWorker(
            "/js/worker.js",
            function (data) {
                console.log(data);
            },
            function (e) {
                e.preventDefault();
                console.error(e.filename + "(" + e.lineno + "): " + e.message);
            }
        );
        
        oDictWorker.addListener("indexedDB", function (tid, action, data) {
            if(action == "get_dictionaries") {
                var aDicts = [];
                indexedDB_handle.transaction("dictionaries")
                    .objectStore("dictionaries").openCursor()
                    .onsuccess = function (event) {
                    var cursor = event.target.result;
                    if(!!cursor == false) 
                        oDictWorker.sendQuery("transaction", tid, aDicts);
                    else {
                        aDicts.push(cursor.value);
                        cursor.continue();
                    }
                }
            } else if(action == "get_history") {
                indexedDB_handle.transaction("history")
                    .objectStore("history").get(0)
                    .onsuccess = function (evt) {
                    var cache = evt.target.result;
                    if(typeof evt.target.result === "undefined") cache = [];
                    oDictWorker.sendQuery("transaction", tid, cache);
                };
            } else if(action == "add_dictionary") {
                var version = parseInt(indexedDB_handle.version)+1;
                indexedDB_handle.close();
                console.log("Opening " + dbName + " v" + version);
                var request = indexedDB.open(dbName, version);
                request.onsuccess = function (e) {
                    data.version = version;
                    indexedDB_handle = request.result;
                    indexedDB_handle.onerror = function (e) {
                        throw new Error("Database error: " + e.target.errorCode);
                    };
                    indexedDB_handle.transaction("dictionaries", "readwrite")
                        .objectStore("dictionaries").add(data, version);
                    oDictWorker.sendQuery("transaction", tid, version);
                };
                request.onupgradeneeded = function (event) {
                    var db = event.target.result;
                    db.createObjectStore("idx"+version);
                    db.createObjectStore("dict"+version);
                };
            } else if(action == "remove_dictionary") {
                var version = parseInt(indexedDB_handle.version)+1;
                indexedDB_handle.close();
                console.log("Opening " + dbName + " v" + version);
                var request = indexedDB.open(dbName, version);
                request.onsuccess = function (e) {
                    indexedDB_handle = request.result;
                    indexedDB_handle.onerror = function (e) {
                        throw new Error("Database error: " + e.target.errorCode);
                    };
                    indexedDB_handle.transaction("dictionaries", "readwrite")
                        .objectStore("dictionaries").delete(data);
                    oDictWorker.sendQuery("transaction", tid);
                };
                request.onupgradeneeded = function (event) {
                        var db = event.target.result;
                        db.deleteObjectStore("idx"+data);
                        db.deleteObjectStore("dict"+data);
                };
            } else if(action == "set_history") {
                indexedDB_handle.transaction("history", "readwrite")
                    .objectStore("history").put(data, 0);
            } else if(action == "set_meta") {
                var did = data.did, data = data.data;
                indexedDB_handle.transaction("dictionaries", "readwrite")
                    .objectStore("dictionaries").put(data, did)
                    .onsuccess = function () {
                        oDictWorker.sendQuery("transaction", tid);
                };
            } else if(action == "get_meta") {
                var did = data.did;
                indexedDB_handle.transaction("dictionaries")
                    .objectStore("dictionaries").get(did)
                    .onsuccess = function (event) {
                        oDictWorker.sendQuery("transaction", tid, event.target.result);
                };
            } else if(action == "store_terms") {
                var did = data.did, chunksize = data.chunksize,
                    idb_ostore = "dict" + did,
                    data = data.data;
                var store = indexedDB_handle
                    .transaction(idb_ostore, "readwrite")
                    .objectStore(idb_ostore), i = 0, totalwordcount = data.length;
                function putNext() {
                    if(data.length > 0) {
                        store.add(data.slice(0,chunksize), i)
                            .onsuccess = function () {
                            i += 1;
                            if(i % 7 == 0)
                                print_progress(
                                    90+10*i*chunksize/totalwordcount,
                                    100, true
                                );
                            data = data.slice(chunksize);
                            putNext();
                        };
                    } else oDictWorker.sendQuery("transaction", tid);
                }
                putNext();
            } else if(action == "store_idx") {
                var did = data.did,
                    idb_ostore = "idx" + did,
                    data = data.data;
                indexedDB_handle.transaction(idb_ostore, "readwrite")
                    .objectStore(idb_ostore).add(data,0)
                    .onsuccess = function () {
                    oDictWorker.sendQuery("transaction", tid);
                };
            } else if(action == "restore_idx") {
                var did = data.did,
                    idb_ostore = "idx" + did,
                    data = data.data;
                indexedDB_handle.transaction(idb_ostore)
                    .objectStore(idb_ostore).get(0)
                    .onsuccess = function (event) {
                        oDictWorker.sendQuery("transaction", tid, event.target.result);
                };
            } else if(action == "get_range") {
                var did = data.did, chunksize = data.chunksize,
                    idb_ostore = "dict" + did,
                    data = data.data,
                    size = dict_by_id(did).size;
                data.len = Math.min(data.len, size - data.start);
                var result = [], len, start = data.start,
                    offset = start / chunksize | 0;
                function getNext() {
                    len = data.len - result.length;
                    if(len > 0)
                        indexedDB_handle.transaction(idb_ostore)
                            .objectStore(idb_ostore).get(offset)
                            .onsuccess = function (evt) {
                            var res = evt.target.result,
                                chunk_a = start%chunksize,
                                chunk_b = chunk_a + len;
                            result = result.concat(res.slice(chunk_a, chunk_b));
                            offset += 1; start = 0;
                            getNext();
                        };
                    else oDictWorker.sendQuery("transaction", tid, result);
                }
                getNext();
            } else if(action == "get") {
                var did = data.did, chunksize = data.chunksize,
                    idb_ostore = "dict" + did,
                    data = data.data;
                var offset = data / chunksize | 0,
                    idx = data%chunksize;
                indexedDB_handle.transaction(idb_ostore)
                    .objectStore(idb_ostore).get(offset)
                    .onsuccess = function(evt) {
                        var ret = evt.target.result[idx];
                        oDictWorker.sendQuery("transaction", tid, ret);
                };
            }
        });
        
        oDictWorker.addListener("scan_dictdata", function (tid) {
            var sdcard = navigator.getDeviceStorage("sdcard"),
                request = sdcard.enumerate("dictdata"),
                result = [];
                
            function add_subdir(n) {
                if(result.length <= n) 
                    oDictWorker.sendQuery("transaction", tid, result);
                else {
                    var req = sdcard.enumerate(result[n]);
                    result[n] = { "path": result[n], "files": [] };
                    req.onsuccess = function () {
                        if(!this.result) add_subdir(n+1);
                        else {
                            result[n].files.push(this.result);
                            this.continue();
                        }
                    };
                }
            }
            
            function split_path(path) {
                pos_slash = path.lastIndexOf('/');
                pos_dot = path.lastIndexOf('.');
                return [
                    path.substring(0, pos_slash),
                    path.substring(pos_slash+1),
                    path.substring(pos_dot+1),
                ];
            }
                
            request.onsuccess = function () {
                if(!this.result) add_subdir(0);
                else {
                    var fname = this.result.name;
                    if(null != fname.match(/^dictdata\/[^\/]+\/[^\/]+\.ifo$/)) {
                        var path = split_path(fname)[0];
                        result.push(path);
                    }
                    this.continue();
                }
            };
        });
        
        oDictWorker.addListener("progress", function (status, total, text) {
            print_progress(status, total, text);
        });
        
        oDictWorker.addListener("init_ready", function (dict_list) {
            aDicts = dict_list;
            if(startup) {
                $(sidebar).find("li#lookup").trigger("click");
                startup = false;
            } else $(sidebar).find("li#manage").trigger("click");
        });
        
        oDictWorker.addListener("printList", function (matches) {
            $(list_section).html("<ul />").show();
            if(matches.length == 0) {
                $(list_section).find("ul")
                    .html("<li><p>Nichts gefunden!</p></li>");
            } else {
                for(var m = 0; m < Math.min(matches.length, 20); m++) {
                    var dlist = [];
                    matches[m].entries.forEach(function (entry) {
                        var did = entry[2];
                        if(dlist.indexOf(did) == -1) dlist.push(did);
                    });
                    p = $("<p />");
                    dlist.forEach(function (d) {
                        $("<span />")
                            .css("background-color",dict_by_id(d).color)
                            .addClass("marker").appendTo(p);
                    });
                    $(p).append(matches[m].term);
                    $("<li />").data("entries", matches[m].entries)
                        .addClass("term_li")
                        .append($("<a href=\"#\" class=\"term\"></a>").append(p))
                        .appendTo($(list_section).find("ul"));
                }
            }
        });
        
        oDictWorker.addListener("printEntry", function (obj, data) {
            function render_pango_content(p, pango_markup, did) {
                dict = dict_by_id(did);
                $(p).append(pango_markup).attr("class","entry")
                    .find("span").each(function () {
                        var replacement = $("<span/>"), sup = false;
                        $.each(this.attributes, function(dummy, attrib){
                            var name = attrib.name;
                            var value = attrib.value;
                            if(name == "font_desc")
                                $(replacement).css("font", value);
                            else if(name == "font_family" || name == "face")
                                $(replacement).css("font-family", value);
                            else if(name == "size" && !isNaN(value))
                                $(replacement).css("font-size", value);
                            else if(name == "style")
                                $(replacement).css("font-style", value);
                            else if(name == "weight") {
                                if(value == "ultrabold") value = "800";
                                else if(value == "heavy") value = "900";
                                else if(value == "light") value = "300";
                                else if(value == "ultralight") value = "200";
                                $(replacement).css("font-weight", value);
                            } else if(name == "variant")
                                $(replacement).css("font-variant",
                                    value.replace("smallcaps","small-caps"));
                            else if(name == "stretch") {
                                value.replace(/(ultra|extra|semi)(condensed|expanded)/g, "$1-$2");
                                $(replacement).css("font-stretch", value);
                            } else if(name == "foreground")
                                $(replacement).css("color", value);
                            else if(name == "background")
                                $(replacement).css("background-color", value);
                            else if(name == "underline") {
                                if(value == "double")
                                    $(replacement).css("border-bottom", "1px #000 double");
                                else if(value == "low")
                                    $(replacement).css("border-bottom", "1px #000 solid");
                                else if(value == "single")
                                    $(replacement).css("text-decoration", "underline");
                            } else if(name == "strikethrough" && value == "true")
                                $(replacement).css("text-decoration", "line-through");
                            else if(name == "rise" && value != "0") sup = true;
                        });
                        if(sup) replacement = $("<sup/>").append(replacement);
                        $(this).replaceWith(replacement).html($(this).html());
                });
                $(p).find("big").each(function () {
                        $(this).replaceWith($("<span/>")).html($(this).html());
                });
                $(p).find("s").each(function () {
                        $(this).replaceWith($("<del/>")).html($(this).html());
                });
                $(p).find("tt").each(function () {
                        $(this).replaceWith($("<code/>")).html($(this).html());
                });
            }
    
            function render_html_content(p, html, did) {
                dict = dict_by_id(did);
                $(p).append(html).attr("class","entry")
                  .find("img").each(function () {
                    var elImg = this,
                        img_filename = $(elImg).attr("src"),
                        rid = aResources.length;
                    aResources.push(function (blob) {
                        if(blob == null)
                            console.log("File " + img_filename + " not found.");
                        else {
                            var reader = new FileReader();
                            reader.onload = function (e) {
                                    $(elImg).attr('src', e.target.result);
                            };
                            reader.readAsDataURL(blob);
                        }
                    });
                    oDictWorker.sendQuery("resource", rid, did, img_filename);
                });
                $(p).find("a").each(function () {
                    linkText = $(this).text();
                    linkRef = $(this).attr("href");
                    if("bword://" != linkRef.substring(0,8)) {
                        $(this).replaceWith(linkText);
                    } else $(this).data("ref",linkRef.substring(8))
                                .attr("href","javascript:void(0)");
                });
            }
    
            var did = obj[2];
            if(data == null || data.length == 0) return;
            data.forEach(function (d) {
                p = $("<p />");
                if("mxtykwr".indexOf(d.type) != -1)
                    $(p).append(document.createTextNode(d.content));
                else if("g".indexOf(d.type) != -1)
                    render_pango_content(p, d.content, did);
                else if("h".indexOf(d.type) != -1)
                    render_html_content(p, d.content, did);
                
                if(obj[0] != obj[1].term)
                    syn = " <b>(Synonym: " + obj[1].term + ")</b>";
                else syn = "";
                
                $(output_area).find("div.dict"+did)
                    .append("<h3>" + obj[0] + syn + "</h3>")
                    .append(p).show().find("h3")
                    .css("background-color", dict_by_id(did).color);
            });
        });
        
        oDictWorker.addListener("resource", function (rid, blob) {
            aResources[rid](blob);
        });
        
        function init_indexedDB() {
            var request = indexedDB.open(dbName);
            
            request.onerror = function (event) {
               throw new Error("Why didn't you allow my web app to use IndexedDB?!");
            };
            
            request.onsuccess = function () {
                indexedDB_handle = request.result;
                indexedDB_handle.onerror = function (e) {
                    throw new Error("Database error: " + e.target.errorCode);
                };
                oDictWorker.sendQuery("init");
            };
            
            request.onupgradeneeded = function(event) {
                var db = event.target.result;
                db.createObjectStore("dictionaries");
                db.createObjectStore("history");
            };
            
            $(sidebar).find("li#lookup").trigger("click");
            print_progress();
        }
        
        init_indexedDB();
    }
    
    init();
});
