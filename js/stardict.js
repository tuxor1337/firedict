(function (GLOBAL) { 
    
    function getUIntAt(arr, offs) {
        out = 0;
        for (var j = offs; j < offs+4; j++) {
                out <<= 8;
                out |= arr.charCodeAt(j) & 0xff;
        }
        return out;
    }
    
    function readUTF8String(bytes) {
        var ix = 0;
        if( bytes.slice(0,3) == "\xEF\xBB\xBF") ix = 3;
        var string = "";
        for( ; ix < bytes.length; ix++ ) {
            var byte1 = bytes[ix].charCodeAt(0);
            if( byte1 < 0x80 ) {
                string += String.fromCharCode(byte1);
            } else if( byte1 >= 0xC2 && byte1 < 0xE0 ) {
                var byte2 = bytes[++ix].charCodeAt(0);
                string += String.fromCharCode(((byte1&0x1F)<<6)
                    + (byte2&0x3F));
            } else if( byte1 >= 0xE0 && byte1 < 0xF0 ) {
                var byte2 = bytes[++ix].charCodeAt(0);
                var byte3 = bytes[++ix].charCodeAt(0);
                string += String.fromCharCode(((byte1&0xFF)<<12) 
                    + ((byte2&0x3F)<<6) + (byte3&0x3F));
            } else if( byte1 >= 0xF0 && byte1 < 0xF5) {
                var byte2 = bytes[++ix].charCodeAt(0);
                var byte3 = bytes[++ix].charCodeAt(0);
                var byte4 = bytes[++ix].charCodeAt(0);
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
        var cls = function(db) {
            var files = { }, index = [], synonyms, db = db;
            var keywords = {
                "version": "",
                "bookname": "",
                "wordcount": "",
                "synwordcount": "",
                "idxfilesize": "",
                "sametypesequence": "",
            };
            var is_dz = false;
            var that = this;
            var dict;
            var progress = 0;
            
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
            
            function data_to_db(tree) {
                console.log("writing to db...");
                tree.toDB(db, progress, function (idb_tree) {
                    synonyms = idb_tree;
                    db.backup_idx(index, process_res);
                });
            }
            
            function process_syn(tree) {
                if(files["syn"] != null) {
                    var reader = new FileReaderSync();
                    var blob = reader.readAsBinaryString(files["syn"]);
                    function rec_syn(i, j) {
                        if(i >= blob.length || progress > 0) data_to_db(tree);
                        else if(blob[i] == "\0") {
                            var synonym = readUTF8String(blob.slice(j,i));
                            var wid = getUIntAt(blob,i+1);
                            tree.addWidToPath(synonym, wid);
                            ++progress;
                            rec_syn(i+5, i+5);
                        } else rec_syn(i+1, j);
                    }
                    rec_syn(0,0,0);
                } else {
                    data_to_db(tree)
                }
            }
            
            function process_idx() {
                var reader = new FileReaderSync();
                var blob = reader.readAsBinaryString(files["idx"]);
                var tree = new DicTree();
                function rec_idx(i, j) {
                    if(i >= blob.length || progress > 10) process_syn(tree);
                    else if(blob[i] == "\0") {
                        var word = readUTF8String(blob.slice(j,i));
                        var offset = getUIntAt(blob,i+1);
                        var size = getUIntAt(blob,i+5);
                        index.push([word,offset,size]);
                        tree.addWidToPath(word, index.length-1);
                        ++progress;
                        rec_idx(i+9, i+9);
                    } else rec_idx(i+1, j);
                }
                rec_idx(0,0,0);
            }
            
            function restore_from_db() {
                db.restore_idx(function (idx) {
                    index = idx;
                    db.get_root(function (root) {
                        synonyms = new DicTree_IDB(db)
                        synonyms.fromData(root, process_res);
                    });
                });
            }
            
            function process_ifo(from_idb) {
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
                if(from_idb) restore_from_db();
                else process_idx();
            }
            
            function process_dictdata(data, callbk) {
                if("" != keywords["sametypesequence"]) {
                    type_str = keywords["sametypesequence"];
                    is_sts = true;
                }
                data_arr = [];
                while(true) {
                    if(is_sts) {
                        t = type_str[0];
                        type_str = type_str.substr(1);
                    } else {
                        t = data[0];
                        data = data.substr(1);
                    }
                    if(is_sts && "" == type_str) d = data;
                    else if(t == t.toUpperCase()) {
                        end = getUIntAt(data,0);
                        d = data.slice(4,end+4);
                        data = data.slice(end+4);
                    } else {
                        end = data.indexOf("\0");
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
            
            this.load = function (main_files, res_files, from_idb) {
                var from_idb = from_idb || false;
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
                if(files["dict"] != null) is_dz = false;
                else if(files["dict.dz"] != null) is_dz = true;
                else {
                    this.onerror("Missing *.dict(.dz) file!");
                    return;
                }
                process_ifo(from_idb);
            };
            
            this.lookup_id = function (wid, callbk) {
                if(wid > index.length) callbk(null,null);
                var idx = index[wid];
                if(is_dz) {
                    var reader = new DictZipFile(JSInflate.inflate);
                    reader.onsuccess = function () {
                        process_dictdata(
                            reader.read(idx[1], idx[2]),
                            function(output) { callbk(output, idx); }
                        );
                    };
                    reader.load(files["dict.dz"]);
                } else {
                    f = files["dict"].slice(
                        idx[1], idx[1] + idx[2]
                    );
                    var reader = new FileReaderSync();
                    process_dictdata(
                        reader.readAsBinaryString(f),
                        function(output) { callbk(output, idx); }
                    );
                }
            };
            
            this.lookup_term = function (word, callbk, fuzzy) {
                if("undefined" === typeof fuzzy) fuzzy = false;
                synonyms.jumpToPath(word, function (node) {
                    if(fuzzy) {
                        if(node == null) callbk([]);
                        else node.deepSearch(20, callbk);
                    } else {
                        if(node == null || node.word_ids.length == 0)
                            callbk(null);
                        else callbk(node.word_ids[0]);
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
