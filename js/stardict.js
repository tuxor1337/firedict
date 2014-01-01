(function (GLOBAL) {
    var SYNCHUNKSIZE = 2531;
    
    function getUintAt(arr, offs) {
        out = 0;
        for (var j = offs; j < offs+4; j++) {
                out <<= 8;
                out |= arr[j] & 0xff;
        }
        return out;
    }
    
    function readUTF8String(bytes) {
        var ix = 0;
        if(bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF) ix = 3;
        var string = "";
        for( ; ix < bytes.length; ix++ ) {
            var byte1 = bytes[ix];
            if( byte1 < 0x80 ) {
                string += String.fromCharCode(byte1);
            } else if( byte1 >= 0xC2 && byte1 < 0xE0 ) {
                var byte2 = bytes[++ix];
                string += String.fromCharCode(((byte1&0x1F)<<6)
                    + (byte2&0x3F));
            } else if( byte1 >= 0xE0 && byte1 < 0xF0 ) {
                var byte2 = bytes[++ix];
                var byte3 = bytes[++ix];
                string += String.fromCharCode(((byte1&0xFF)<<12)
                    + ((byte2&0x3F)<<6) + (byte3&0x3F));
            } else if( byte1 >= 0xF0 && byte1 < 0xF5) {
                var byte2 = bytes[++ix];
                var byte3 = bytes[++ix];
                var byte4 = bytes[++ix];
                var codepoint = ((byte1&0x07)<<18) + ((byte2&0x3F)<<12)
                    + ((byte3&0x3F)<<6) + (byte4&0x3F);
                codepoint -= 0x10000;
                string += String.fromCharCode(
                    (codepoint>>10) + 0xD800,
                    (codepoint&0x3FF) + 0xDC00
                );
            }
        }
        return string;
    }
    
    var StarDict = (function () {
        var cls = function(db, cmp_fct) {
            var files = { },
                index = [],
                db = db,
                keywords = {
                    "version": "",
                    "bookname": "",
                    "wordcount": "",
                    "synwordcount": "",
                    "idxfilesize": "",
                    "sametypesequence": "",
                    "is_dz": false,
                    "dbwordcount": 0
                },
                cmp_func = cmp_fct || function (a,b) {
                    a = a.toLowerCase(), b = b.toLowerCase();
                    if(a > b) return 1;
                    if(a < b) return -1;
                    return 0;
                };
            var that = this;
            var syn_chunk_list = [];
            var progress = 0; // for debugging purposes, see process_syn
                              // and process_idx respectively
            
            function getSynonymAt(offset) {
                var reader = new FileReaderSync(),
                    buffer = reader.readAsArrayBuffer(files["syn"]),
                    view = new Uint8Array(buffer, offset),
                    term = "", wid = -1;
                for(var i = 0; i < view.length; i++) {
                    if(view[i] == 0) {
                        wid = getUintAt(view, i+1);
                        term = readUTF8String(view.subarray(0,i));
                        break;
                    }
                }
                return [term, wid];
            }
            
            function getIndexById(wid) {
                var offset = index[wid],
                    reader = new FileReaderSync(),
                    buffer = reader.readAsArrayBuffer(files["idx"]),
                    view = new Uint8Array(buffer, offset),
                    term = "", offset = -1, size = 0;
                for(var i = 0; i < view.length; i++) {
                    if(view[i] == 0) {
                        term = readUTF8String(view.subarray(0,i));
                        offset = getUintAt(view, i+1);
                        size = getUintAt(view, i+5);
                        break;
                    }
                }
                return [term, offset, size];
            }
            
            function getTermFromObj(obj) {
                if(obj.type == 0) return getIndexById(obj.offset)[0];
                else {
                    return getSynonymAt(obj.offset)[0];
                }
            }
            
            function decodeObj(obj) {
                var idx, synonym, result = [];
                if(obj.type == 0) {
                    idx = getIndexById(obj.offset);
                    synonym = idx[0];
                } else {
                    synonym = getSynonymAt(obj.offset);
                    idx = getIndexById(synonym[1]);
                    synonym = synonym[0];
                }
                result = [synonym].concat(idx);
                result.push(db.did);
                return result;
            }
            
            function binaryInsert(arr, newElement) {
                var minIndex = 0,
                    maxIndex = arr.length - 1,
                    currentIndex,
                    currentCmp;
                
                while (minIndex <= maxIndex) {
                    currentIndex = (minIndex + maxIndex) / 2 | 0;
                    currentCmp = cmp_func(arr[currentIndex][0], newElement[0]);
                    
                    if (currentCmp == -1) {
                        minIndex = currentIndex + 1;
                    } else if (currentCmp == 1) {
                        maxIndex = currentIndex - 1;
                    } else {
                        minIndex = currentIndex;
                        break;
                    }
                }
                arr.splice(minIndex, 0, newElement);
                return minIndex;
            }
            
            function data_to_db(tmp_synonyms) {
                var tmp_arr = [];
                for(var i = 0; i < tmp_synonyms.length; i++) {
                    var syn = tmp_synonyms[i];
                    if(i % SYNCHUNKSIZE == 0) syn_chunk_list.push(syn[0]);
                    tmp_synonyms[i] = { type: syn[1], offset: syn[2] };
                }
                db.store_synonyms(tmp_synonyms, function () {
                    keywords.dbwordcount = tmp_synonyms.length;
                    delete tmp_synonyms;
                    db.backup_idx(index, process_res);
                });
            }
            
            function restore_from_db() {
                console.log("restoring...");
                db.restore_idx(function (idx) {
                    index = idx;
                    var i = 0;
                    function recSyn() {
                        if(i < keywords.dbwordcount)
                            db.get(i, function (obj) {
                                syn_chunk_list.push(getTermFromObj(obj));
                                i += SYNCHUNKSIZE;
                                recSyn();
                            });
                        else process_res();
                    }
                    recSyn();
                });
            }
            
            function process_res() {
                if(files["res"].length > 0) {
                    filelist = files["res"];
                    files["res"] = [];
                    that.add_resources(filelist);
                    that.loaded = true;
                    that.onsuccess();
                } else {
                    that.loaded = true;
                    that.onsuccess();
                }
            }
            
            function process_syn(tmp_synonyms) {
                progress = 0;
                if(files["syn"] != null) {
                    var reader = new FileReaderSync(),
                        buffer = reader.readAsArrayBuffer(files["syn"]),
                        view = new Uint8Array(buffer);
                    for(var i = 0, j = 0; i < view.length; i++) {
                        if(view[i] == 0) {
                            //if(progress > 1000) break;
                            //if(progress < 50000){i+=5;j=i;progress++;continue;}
                            progress += 1;
                            if(progress % 2743 == 0)
                                reply("progress", progress, keywords.synwordcount);
                            var term = readUTF8String(view.subarray(j,i));
                            binaryInsert(tmp_synonyms, [term, 1, j]);
                            i += 5; j = i;
                        }
                    }
                    data_to_db(tmp_synonyms);
                } else data_to_db(tmp_synonyms);
            }
            
            function process_idx() {
                var reader = new FileReaderSync(),
                    buffer = reader.readAsArrayBuffer(files["idx"]),
                    view = new Uint8Array(buffer),
                    tmp_synonyms = [];
                for(var i = 1, j = 0; i < view.length; i++) {
                    if(view[i] == 0) {
                        //if(progress > 1000) break;
                        //if(progress < 50000){i+=9;j=i;progress++;continue;}
                        //progress += 1;
                        //if(progress % 2867 == 0)
                        //    reply("progress", progress, keywords.wordcount);
                        var term = readUTF8String(view.subarray(j,i));
                        binaryInsert(tmp_synonyms, [term, 0, index.length]);
                        index.push(j);
                        i += 9; j = i;
                    }
                }
                process_syn(tmp_synonyms);
            }
            
            function process_ifo() {
                reader = new FileReaderSync();
                lines = reader.readAsText(files["ifo"]).split("\n");
                if(lines.shift() != "StarDict's dict ifo file") {
                    theDict.onerror("Not a proper ifo file");
                    return;
                }
                lines.forEach(function (l) {
                    w = l.split("=");
                    keywords[w[0]] = w[1];
                });
                if(keywords.dbwordcount > -1) restore_from_db();
                else process_idx();
            }
            
            function process_dictdata(data, callbk) {
                var is_sts = false, data_arr = [];
                if("" != keywords["sametypesequence"]) {
                    type_str = keywords["sametypesequence"];
                    is_sts = true;
                }
                while(true) {
                    if(is_sts) {
                        t = type_str[0];
                        type_str = type_str.substr(1);
                    } else {
                        t = String.fromCharCode(data[0]);
                        data = data.slice(1);
                    }
                    if(is_sts && "" == type_str) d = data;
                    else if(t == t.toUpperCase()) {
                        end = getUIntAt(data,0);
                        d = data.slice(4,end+4);
                        data = data.slice(end+4);
                    } else {
                        end = data.indexOf(0);
                        d = data.slice(0,end);
                        data = data.slice(end+1);
                    }
                    if("mgtxykwh".indexOf(t) != -1) d = readUTF8String(d);
                    data_arr.push([d, t]);
                    if(data.length == 0 || (is_sts && type_str == ""))
                        break;
                }
                callbk(data_arr);
            }
            
            this.onerror = function (err) { console.err(err); };
            this.onsuccess = function () { };
            this.loaded = false;
            
            this.load = function (main_files, res_files, dbwordcount) {
                keywords.dbwordcount = dbwordcount || -1;
                if(typeof res_files === "undefined") res_files = [];
                files["res"] = res_files;
                ["idx","syn","dict","dict.dz","ifo"].forEach(function(d) {
                    files[d] = null;
                    for(var i=0; i < main_files.length; i++) {
                        ext = main_files[i].name.substr(-1-d.length);
                        if(ext == "." + d) files[d] = main_files[i];
                    }
                });
                
                if(files["ifo"] == null) {
                    this.onerror("Missing *.ifo file!");
                    return;
                }
                
                if(files["idx"] == null) {
                    this.onerror("Missing *.idx file!");
                    return;
                }
                
                if(files["dict"] != null) keywords.is_dz = false;
                else if(files["dict.dz"] != null) keywords.is_dz = true;
                else {
                    this.onerror("Missing *.dict(.dz) file!");
                    return;
                }
                process_ifo();
            };
            
            this.get_entry = function (decodedObj, callbk) {
                var offset = decodedObj[2],
                    size = decodedObj[3];
                if(keywords.is_dz) {
                    var reader = new DictZipFile(JSInflate.inflate);
                    reader.onsuccess = function () {
                        var binstr = reader.read(offset, size),
                            intarr = [];
                        for(var i = 0; i < binstr.length; i++) {
                            intarr.push(binstr.charCodeAt(i));
                        }
                        process_dictdata(intarr, callbk);
                    };
                    reader.load(files["dict.dz"]);
                } else {
                    f = files["dict"].slice(offset, offset + size);
                    var reader = new FileReaderSync(),
                        buffer = reader.readAsArrayBuffer(f),
                        view = new Uint8Array(buffer);
                    process_dictdata(view, callbk);
                }
            };
            
            this.lookup_term = function (word, callbk, fuzzy) {
                if(typeof fuzzy === "undefined") fuzzy = false;
                function cmp(obj) {
                    var term = getTermFromObj(obj);
                    if(fuzzy) term = term.substr(0, word.length);
                    return cmp_func(term, word);
                }
                var offset;
                    
                function binarySearch(mode, arr) {
                    var miIndex = 0;
                    var maIndex = arr.length - 1;
                    var currIndex;
                    var currCmp;
                    
                    while (miIndex <= maIndex) {
                        currIndex = (miIndex + maIndex) / 2 | 0;
                        if(mode == "max") currCmp = cmp_func(arr[currIndex], word);
                        else currCmp = cmp_func(getTermFromObj(arr[currIndex]), word);
                        
                        if (currCmp == -1) {
                            miIndex = currIndex + 1;
                        } else if (currCmp == 1) {
                            maIndex = currIndex - 1;
                        } else {
                            if(mode == "max") maIndex = currIndex;
                            else miIndex = currIndex;
                            break;
                        }
                    }
                    if(mode == "max") return maIndex;
                    else return miIndex;
                }
                offset = binarySearch("max", syn_chunk_list);
                if(offset == -1) { callbk([]); return; }
                else offset *= SYNCHUNKSIZE;
                db.get_range(offset, SYNCHUNKSIZE, function (list) {
                    var currentIndex, currentObj, currentCmp, lastMatch = null;
                    currentIndex = binarySearch("min", list);
                    currentObj = list[currentIndex];
                    currentCmp = cmp(currentObj);
                    if(currentCmp == 0) lastMatch = currentObj;
                    if(lastMatch == null) callbk([]);
                    else {
                        function process_range(range) {
                            var result = [];
                            for(var r = 0; r < range.length; r++) {
                                currentObj = range[r];
                                currentCmp = cmp(currentObj, word); 
                                if(currentCmp != 0) break;
                                else result.push(decodeObj(currentObj));
                            }
                            callbk(result);
                        }
                        if(currentIndex + 20  < SYNCHUNKSIZE) {
                            process_range(list.slice(currentIndex,currentIndex+20));
                        } else {
                            db.get_range(offset + currentIndex, 20, process_range);
                        }
                    }
                });
            };
            
            this.add_resources = function (res_filelist) {
                for(var f = 0; f < res_filelist.length; f++)
                    files["res"].push(res_filelist[f]);
            };
            
            this.request_res = function (filename) {
                filename = filename.replace(/^\x1E/, '');
                filename = filename.replace(/\x1F$/, '');
                for(var f = 0; f < files["res"].length; f++) {
                    var fname = files["res"][f].name;
                    if(filename == fname.substring(
                        fname.lastIndexOf("/")+1
                    )) return files["res"][f];
                }
                console.log("Resource "+filename+" not available");
                return null;
            };
            
            this.get_key = function (key) { return keywords[key]; };
        }
        
        return cls;
    })()
    
    GLOBAL.StarDict = StarDict;
}(this));
