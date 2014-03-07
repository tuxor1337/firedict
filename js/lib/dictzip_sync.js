/**
 * @license dictzip.js
 * (c) 2013-2014 http://github.com/tuxor1337/dictzip.js
 * License: MIT
 */
(function (GLOBAL) {
    function intArrayToString(arr) {
        ret = ""
        for(var i = 0; i < arr.length; i++) {
            ret += String.fromCharCode(arr[i]);
        }
        return ret;
    }
    
    function mergeArrayBuffers(buffer1, buffer2) {
        var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    };
    
    function zero_terminated_string(buffer, offset) {
        var result = "";
        for(var n = 1; true; n++) {
            offset = offset - result.length;
            var view = new Uint8Array(buffer.slice(offset, offset + n * 1024)),
                end = Array.prototype.indexOf.call(view,0);
            if(end == -1) {
                end = view.length;
                if(end == 0) throw new Error("Unexpected end of buffer");
            }
            result += intArrayToString(view.subarray(0, end));
            if(end < view.length) break;
        }
        return result;
    }
            
    function read_gzip_header(buffer) {
        var FTEXT = 1,
            FHCRC = 2,
            FEXTRA = 4,
            FNAME = 8,
            FCOMMENT = 16;
            
        var position = 0,
            view = new Uint8Array(buffer, position, 10),
            header_data = {
                "ID1": 0,
                "ID2": 0,
                "CM": 0,
                "FLG": 0,
                "MTIME": 0,
                "XFL": 0,
                "OS": 0,
                "FEXTRA": {
                    "XLEN": 0,
                    "SUBFIELDS": [],
                },
                "FNAME": "",
                "FCOMMENT": "",
                "FHCRC": "",
        };
    
        if(view[0] != 0x1F || view[1] != 0x8B)
            throw new Error("Not a gzip header.");
        header_data["ID1"] = view[0];
        header_data["ID2"] = view[1];
        header_data["CM"] = view[2];
        header_data["FLG"] = view[3];
        header_data["MTIME"] = view[4] << 0;
        header_data["MTIME"] |= view[5] << 8;
        header_data["MTIME"] |= view[6] << 16;
        header_data["MTIME"] |= view[7] << 24;
        header_data["XFL"] = view[8];
        header_data["OS"] = view[9];
        position += 10;
        
        // FEXTRA
        if((header_data["FLG"] & FEXTRA) != 0x00) {
            view = new Uint16Array(buffer, position, 2);
            header_data["FEXTRA"]["XLEN"] = view[0];
            position += 2;
            
            // FEXTRA SUBFIELDS
            view = new Uint8Array(buffer, position, header_data["FEXTRA"]["XLEN"]);
            while(true) {
                var len = view[2] + 256*view[3];
                subfield = {
                    "SI1": String.fromCharCode(view[0]),
                    "SI2": String.fromCharCode(view[1]),
                    "LEN": len,
                    "DATA": view.subarray(4, 4 + len)
                };
                header_data["FEXTRA"]["SUBFIELDS"].push(subfield);
                view = view.subarray(4 + len);
                if(view.length == 0) break;
            }
            position += header_data["FEXTRA"]["XLEN"];
        }
        
        // FNAME
        if((header_data["FLG"] & FNAME) != 0x00) {
            header_data["FNAME"] = zero_terminated_string(buffer, position);
            position += header_data["FNAME"].length;
        }
        
        // FCOMMENT        
        if((header_data["FLG"] & FCOMMENT) != 0x00) {
            header_data["FCOMMENT"] = zero_terminated_string(buffer, position);
            length += header_data["FCOMMENT"].length;
        }
            
        // FHCRC       
        if((header_data["FLG"] & FHCRC) != 0x00) {
            view = new Uint16Array(buffer, position, 2);
            header_data["FHCRC"] = view[0];
            position += 2;
        }
        
        header_data["LENGTH"] = position+1;
        return header_data;
    }
    
    
    var DictZipFile = (function () {
        var cls = function (f, gunzip_func) {
            var dzfile = f,
                gunzip = gunzip_func,
                verified = false,
                gzip_header,
                ver, chlen = 0, chcnt = 0, chunks = [];
            
            if(!(gunzip instanceof Function)) {
                throw new Error("Given gunzip_func is not a function.");
            }
            
            function get_chunks(buffer) {
                gzip_header = read_gzip_header(buffer);
                var subfields = gzip_header["FEXTRA"]["SUBFIELDS"],
                    found = false, sf;
                for(var i = 0; i < subfields.length; i++) {
                    sf = subfields[i];
                    if(sf["SI1"] == 'R' || sf["SI2"] == 'A') {
                        found = true; break;
                    }
                }
                if(!found) {
                    throw new Error("Not a dictzip header.");
                } else {
                    var b = sf["DATA"];
                    ver = b[0] + 256 * b[1];
                    chlen = b[2] + 256 * b[3];
                    chcnt = b[4] + 256 * b[5];
                    for(var i = 0, chpos = 0; 
                       i < chcnt && 2*i + 6 < b.length;
                       i++) {
                        var tmp_chlen = b[2*i + 6] + 256*b[2*i+7];
                        chunks.push([chpos,tmp_chlen]);
                        chpos += tmp_chlen;
                    }
                    verified = true;
                    return true;
                }
            }
            
            // this.load()
            var reader = new FileReaderSync();
            get_chunks(reader.readAsArrayBuffer(dzfile));
            
            this.read = function (pos, len) {
                if(!verified) {
                    throw new Error("Read attempt before loadend.");
                }
                if(typeof pos === "undefined") pos = 0;
                if(typeof len === "undefined") len = chlen * chunks.length;
                var firstchunk = Math.min(Math.floor(pos/chlen), chunks.length-1),
                    lastchunk = Math.min(Math.floor((pos+len)/chlen), chunks.length-1),
                    offset = pos - firstchunk*chlen,
                    finish = offset + len;
                    
                var reader = new FileReaderSync(),
                    out_buffer = new ArrayBuffer(0),
                    in_buffer = reader.readAsArrayBuffer(dzfile.slice(
                        gzip_header["LENGTH"] + chunks[firstchunk][0],
                        gzip_header["LENGTH"] + chunks[lastchunk][0] + chunks[lastchunk][1]
                ));
                
                for(var i = firstchunk, j = 0;
                   i <=  lastchunk && j < in_buffer.byteLength;
                   j += chunks[i][1], i++) {
                    var chunk = in_buffer.slice(j,j+chunks[i][1]),
                        inflated = gunzip(chunk, 0, chunk.byteLength);
                    out_buffer = mergeArrayBuffers(out_buffer, inflated);
                }
                
                return out_buffer.slice(offset, finish);
            };
        };
    
        return cls;
    })();
    
    GLOBAL.DictZipFile = DictZipFile;
}(this));
