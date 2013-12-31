
(function (GLOBAL) {
    function intArrayToString(arr) {
        ret = ""
        for(var i = 0; i < arr.length; i++) {
            ret += String.fromCharCode(arr[i]);
        }
        return ret;
    }
    
    function stringToIntArray(str) {
        ret = []
        for(var i = 0; i < str.length; i++) {
            ret.push(str[i].charCodeAt(0));
        }
        return ret;
    }
    
    var GzipHeaderReader = (function () {
        var FTEXT = 1,
            FHCRC = 2,
            FEXTRA = 4,
            FNAME = 8,
            FCOMMENT = 16;
            
        var cls = function () {
            var gzfile;
            var header_data = new Object;
            var that = this;
            
            function read_fhcrc() {            
                if((header_data["FLG"] & FHCRC) != 0x00) {
                    that.length += 2;
                    var reader = new FileReaderSync();
                    header_data["FHCRC"] = reader.readAsBinaryString(
                        dzfile.slice(that.length, that.length + 2)
                    );
                    that.onread(header_data);
                } else {
                    that.onread(header_data);
                }
            }
            
            function read_fcomment(n) {
                if(typeof n === "undefined") n = 1;
                
                if((header_data["FLG"] & FCOMMENT) != 0x00) {
                    reader = new FileReaderSync();
                    offset = that.length - header_data["FCOMMENT"].length;
                    blob = reader.readAsBinaryString(
                        gzfile.slice(offset, offset + n * 1024)
                    );
                    for(var i = 0; i < blob.length; i++) {
                        that.length += 1;
                        if(blob[i] != "\0") {
                            header_data["FCOMMENT"] += blob[i];
                        } else {
                            read_fhcrc();
                            return;
                        }
                    }
                    read_fcomment(n+1);
                } else {
                    read_fhcrc();
                }
            }
            
            function read_fname(n) {
                if(typeof n === "undefined") n = 1;
                
                if((header_data["FLG"] & FNAME) != 0x00) {
                    var reader = new FileReaderSync();
                    var offset = that.length - header_data["FNAME"].length;
                    var blob = reader.readAsBinaryString(
                        gzfile.slice(offset, offset + n * 1024)
                    );
                    for(var i = 0; i < blob.length; i++) {
                        that.length += 1;
                        if(blob[i] != "\0") {
                            header_data["FNAME"] += blob[i];
                        } else {
                            read_fcomment();
                            return;
                        }
                    }
                    read_fname(n+1);
                } else {
                    read_fcomment();
                }
            }
            
            function read_fextra_subfields() {
                that.length += 2;
                var reader = new FileReaderSync();
                var blob = stringToIntArray(reader.readAsBinaryString(
                    gzfile.slice(
                        that.length,
                        that.length + header_data["FEXTRA"]["XLEN"]
                    )
                ));
                while(true) {
                    len = blob[2] + 256*blob[3];
                    subfield = {};
                    subfield["SI1"] = String.fromCharCode(blob[0]);
                    subfield["SI2"] = String.fromCharCode(blob[1]);
                    subfield["LEN"] = len;
                    subfield["DATA"] = intArrayToString(
                        blob.slice(4, 4 + len)
                    );
                    header_data["FEXTRA"]["SUBFIELDS"].push(subfield);
                    blob = blob.slice(4 + len);
                    if(blob.length == 0) break;
                }
                that.length += header_data["FEXTRA"]["XLEN"];
                read_fname();
            }
            
            function read_fextra() {
                if((header_data["FLG"] & FEXTRA) != 0x00) {
                    var reader = new FileReaderSync();
                    var xlen_blob = stringToIntArray(
                        reader.readAsBinaryString(
                            gzfile.slice(that.length, that.length + 2)
                        )
                    );
                    xlen = xlen_blob[0] + 256 * xlen_blob[1];
                    header_data["FEXTRA"]["XLEN"] = xlen;
                    read_fextra_subfields();
                } else {
                    read_fname();
                }
            }
            
            this.onread = function () { };
            this.onerror = function (err) { console.log(err); };
            this.length = 0;
            
            this.read = function (f) {
                gzfile = f;
                header_data = {
                    "ID1": 0,
                    "ID2": 0,
                    "CM": 0,
                    "FLG": 0,
                    "FEXTRA": {
                        "XLEN": 0,
                        "SUBFIELDS": [],
                    },
                    "FNAME": "",
                    "FCOMMENT": "",
                    "FHCRC": "",
                };
                this.length = 10;
                var reader = new FileReaderSync();
                var blob = stringToIntArray(
                    reader.readAsBinaryString(gzfile.slice(0,10))
                );
                if(blob[0] != 0x1F || blob[1] != 0x8B) {
                    this.onerror("Not a gzip header.");
                    return;
                }
                header_data["ID1"] = blob[0];
                header_data["ID2"] = blob[1];
                header_data["CM"] = blob[2];
                header_data["FLG"] = blob[3];
                read_fextra();
            };
        };
        
        return cls;
    })();
    
    
    var DictZipFile = (function () {
        var cls = function (gunzip_func) {
            var dzfile;
            var verified = false, firstpos = 1;
            var gzip_header;
            var ver, chunks = [], chlen = 0, chcnt = 0;
            var that = this;
            var gunzip = gunzip_func;
            
            if(!(gunzip instanceof Function)) {
                throw "Given gunzip_func is not a function.";
            }
            
            this.onsuccess = function () { };
            this.onerror = function () { };
            
            this.load = function(f) {
                dzfile = f;
                reader = new GzipHeaderReader();
                reader.onread = (function (theDzFile) {
                    return function(data) {
                        gzip_header = data;
                        firstpos = this.length;
                        subfields = gzip_header["FEXTRA"]["SUBFIELDS"];
                        var found = false, sf;
                        for(var i = 0; i < subfields.length; i++) {
                            sf = subfields[i];
                            if(sf["SI1"] == 'R' || sf["SI2"] == 'A') {
                                found = true; break;
                            }
                        }
                        if(!found) {
                            theDzFile.onerror("Not a dictzip header.")
                        } else {
                            b = stringToIntArray(sf["DATA"]);
                            ver = b[0] + 256 * b[1];
                            chlen = b[2] + 256 * b[3];
                            chcnt = b[4] + 256 * b[5];
                            for(var i = 0, chpos = 0; 
                               i < chcnt && 2*i + 6 < b.length;
                               i++) {
                                thischlen = b[2*i + 6] + 256*b[2*i+7];
                                chunks.push([chpos,thischlen]);
                                chpos += thischlen;
                            }
                        }
                        theDzFile.verified = true;
                        theDzFile.onsuccess();
                    };
                })(this);
                reader.read(f);
            };
            
            this.read = function (pos, len, callbk) {
                if(!this.verified) {
                    this.onerror("Read attempt before loadend.");
                }
                var firstchunk = Math.floor(pos/chlen);
                var offset = pos - firstchunk*chlen;
                var lastchunk = Math.floor((pos+len)/chlen);
                var finish = offset + len;
                
                var reader = new FileReaderSync();
                var blob = reader.readAsBinaryString(dzfile.slice(
                    firstpos + chunks[firstchunk][0],
                    firstpos + chunks[lastchunk][0] + chunks[lastchunk][1]
                ));
                var buf = "";
                for(var i = firstchunk, j = 0;
                   i <=  lastchunk && j < blob.length;
                   j += chunks[i][1], i++) {
                    inflated = gunzip(blob.slice(j,j+chunks[i][1]));
                    buf += inflated;
                }
                return buf.slice(offset,finish);
            };
        };
    
        return cls;
    })();
    
    GLOBAL.DictZipFile = DictZipFile;
}(this));
