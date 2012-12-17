// Generated by CoffeeScript 1.3.3
(function() {

  var merge, merge_sort;

  merge = function(left, right, comparison) {
    var result;
    result = new Array();
    while ((left.length > 0) && (right.length > 0)) {
      if (comparison(left[0], right[0]) <= 0) {
        result.push(left.shift());
      } else {
        result.push(right.shift());
      }
    }
    while (left.length > 0) {
      result.push(left.shift());
    }
    while (right.length > 0) {
      result.push(right.shift());
    }
    return result;
  };

  merge_sort = function(array, comparison) {
    var middle;
    if (array.length < 2) {
      return array;
    }
    middle = Math.ceil(array.length / 2);
    return merge(merge_sort(array.slice(0, middle), comparison), merge_sort(array.slice(middle), comparison), comparison);
  };

  var crypto, int32Max, merge_sort;

  crypto = require("crypto");

  int32Max = Math.pow(2, 32);

  getTable = function(key) {
    var ah, al, decrypt_table, hash, i, md5sum, table;
    table = new Array(256);
    decrypt_table = new Array(256);
    md5sum = crypto.createHash("md5");
    md5sum.update(key);
    hash = new Buffer(md5sum.digest(), "binary");
    al = hash.readUInt32LE(0);
    ah = hash.readUInt32LE(4);
    i = 0;
    while (i < 256) {
      table[i] = i;
      i++;
    }
    i = 1;
    while (i < 1024) {
      table = merge_sort(table, function(x, y) {
        return ((ah % (x + i)) * int32Max + al) % (x + i) - ((ah % (y + i)) * int32Max + al) % (y + i);
      });
      i++;
    }
    i = 0;
    while (i < 256) {
      decrypt_table[table[i]] = i;
      ++i;
    }
    return [table, decrypt_table];
  };

  encrypt = function(table, buf) {
    var i;
    i = 0;
    while (i < buf.length) {
      buf[i] = table[buf[i]];
      i++;
    }
    return buf;
  };

  parseArgs = function() {
    var defination, lastKey, nextIsValue, oneArg, result, _, _ref;
    defination = {
      '-l': 'local_port',
      '-p': 'server_port',
      '-s': 'server',
      '-k': 'password'
    };
    result = {};
    nextIsValue = false;
    lastKey = null;
    _ref = process.argv;
    for (_ in _ref) {
      oneArg = _ref[_];
      if (nextIsValue) {
        result[lastKey] = oneArg;
        nextIsValue = false;
      } else if (oneArg in defination) {
        lastKey = defination[oneArg];
        nextIsValue = true;
      }
    }
    return result;
  };

  var KEY, PORT, REMOTE_PORT, SERVER, config, configContent, configFromArgs, decryptTable, encrypt, encryptTable, fs, getServer, inetAton, inetNtoa, k, net, path, server, tables, timeout, v;

  inetNtoa = function(buf) {
    return buf[0] + "." + buf[1] + "." + buf[2] + "." + buf[3];
  };

  inetAton = function(ipStr) {
    var buf, i, parts;
    parts = ipStr.split(".");
    if (parts.length !== 4) {
      return null;
    } else {
      buf = new Buffer(4);
      i = 0;
      while (i < 4) {
        buf[i] = +parts[i];
        i++;
      }
      return buf;
    }
  };

  fs = require("fs");

  path = require("path");

  configFromArgs = parseArgs();

  config = {
    "server": "127.0.0.1",
    "server_port": 8388,
    "local_prot": 1080,
    "password": "test",
    "timeout": 60
  }

  for (k in configFromArgs) {
    v = configFromArgs[k];
    config[k] = v;
  }

  SERVER = config.server;

  REMOTE_PORT = config.server_port;

  PORT = config.local_port;

  KEY = config.password;

  timeout = Math.floor(config.timeout * 1000);

  getServer = function() {
    if (SERVER instanceof Array) {
      return SERVER[Math.floor(Math.random() * SERVER.length)];
    } else {
      return SERVER;
    }
  };

  net = require("net");

  console.log = function() {};

  var pid = ""+process.pid; // need to turn into a string
  fs.writeFile('/data/data/com.github.shadowsocks/shadowsocks.pid', pid, function (err) {
     // Ignore
  });

  console.log("calculating ciphers");

  tables = getTable(KEY);

  encryptTable = tables[0];

  decryptTable = tables[1];

  server = net.createServer(function(connection) {
    var addrLen, addrToSend, cachedPieces, headerLength, remote, remoteAddr, remotePort, stage;
    console.log("server connected");
    console.log("concurrent connections: " + server.connections);
    stage = 0;
    headerLength = 0;
    remote = null;
    cachedPieces = [];
    addrLen = 0;
    remoteAddr = null;
    remotePort = null;
    addrToSend = "";
    connection.on("data", function(data) {
      var aServer, addrtype, buf, cmd, reply, tempBuf;
      if (stage === 5) {
        encrypt(encryptTable, data);
        // Android Patch
        try {
          if (remote == null || !remote.write(data)) {
            connection.pause();
          }
        } catch (e) {
          connection.pause();
          console.warn("unexpected exception: " + e);
        }
        return;
      }
      if (stage === 0) {
        tempBuf = new Buffer(2);
        tempBuf.write("\u0005\u0000", 0);
        connection.write(tempBuf);
        stage = 1;
        return;
      }
      if (stage === 1) {
        try {
          cmd = data[1];
          addrtype = data[3];
          if (cmd !== 1) {
            console.warn("unsupported cmd: " + cmd);
            reply = new Buffer("\u0005\u0007\u0000\u0001", "binary");
            connection.end(reply);
            return;
          }
          if (addrtype === 3) {
            addrLen = data[4];
          } else if (addrtype !== 1) {
            console.warn("unsupported addrtype: " + addrtype);
            connection.end();
            return;
          }
          addrToSend = data.slice(3, 4).toString("binary");
          if (addrtype === 1) {
            remoteAddr = inetNtoa(data.slice(4, 8));
            addrToSend += data.slice(4, 10).toString("binary");
            remotePort = data.readUInt16BE(8);
            headerLength = 10;
          } else {
            remoteAddr = data.slice(5, 5 + addrLen).toString("binary");
            addrToSend += data.slice(4, 5 + addrLen + 2).toString("binary");
            remotePort = data.readUInt16BE(5 + addrLen);
            headerLength = 5 + addrLen + 2;
          }
          buf = new Buffer(10);
          buf.write("\u0005\u0000\u0000\u0001", 0, 4, "binary");
          buf.write("\u0000\u0000\u0000\u0000", 4, 4, "binary");
          buf.writeInt16BE(remotePort, 8);
          connection.write(buf);
          aServer = getServer();
          remote = net.connect(REMOTE_PORT, aServer, function() {
            var addrToSendBuf, i, piece;
            console.log("connecting " + remoteAddr + " via " + aServer);
            addrToSendBuf = new Buffer(addrToSend, "binary");
            encrypt(encryptTable, addrToSendBuf);
            remote.write(addrToSendBuf);
            i = 0;
            while (i < cachedPieces.length) {
              piece = cachedPieces[i];
              encrypt(encryptTable, piece);
              remote.write(piece);
              i++;
            }
            cachedPieces = null;
            return stage = 5;
          });
          remote.on("data", function(data) {
            encrypt(decryptTable, data);
            if (!connection.write(data)) {
              return remote.pause();
            }
          });
          remote.on("end", function() {
            console.log("remote disconnected");
            connection.end();
            return console.log("concurrent connections: " + server.connections);
          });
          remote.on("error", function() {
            if (stage === 4) {
              console.warn("remote connection refused");
              connection.destroy();
              return;
            }
            console.warn("remote error");
            connection.end();
            return console.log("concurrent connections: " + server.connections);
          });
          remote.on("drain", function() {
            return connection.resume();
          });
          remote.setTimeout(timeout, function() {
            connection.end();
            return remote.destroy();
          });
          if (data.length > headerLength) {
            buf = new Buffer(data.length - headerLength);
            data.copy(buf, 0, headerLength);
            cachedPieces.push(buf);
            buf = null;
          }
          return stage = 4;
        } catch (e) {
          console.warn(e);
          connection.destroy();
          if (remote) {
            return remote.destroy();
          }
        }
      } else {
        if (stage === 4) {
          return cachedPieces.push(data);
        }
      }
    });
    connection.on("end", function() {
      console.log("server disconnected");
      if (remote) {
        remote.destroy();
      }
      return console.log("concurrent connections: " + server.connections);
    });
    connection.on("error", function() {
      console.warn("server error");
      if (remote) {
        remote.destroy();
      }
      return console.log("concurrent connections: " + server.connections);
    });
    connection.on("drain", function() {
      if (remote && stage === 5) {
        return remote.resume();
      }
    });
    return connection.setTimeout(timeout, function() {
      if (remote) {
        remote.destroy();
      }
      return connection.destroy();
    });
  });

  server.listen(PORT, function() {
    return console.log("server listening at port " + PORT);
  });

  server.on("error", function(e) {
    if (e.code === "EADDRINUSE") {
      return console.warn("Address in use, aborting");
    }
  });

}).call(this);
