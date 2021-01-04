'use strict';

const crypto = require("crypto");

class Distribution {
  magic = "DIS";
  version = 2;
  supported = true;
  modules = [];
  ignored = [];

  constructor(){
    this.download();
  }

  async download(){
    this.position = 3;
    if(this.buffer){
      let sha1 = await fetch("http://download.paladium-pvp.fr/launcher/distribution.bin.sha1").then(res => res.text());
      if(sha1 == crypto.createHash('sha1').update(this.buffer).digest("hex")) return;
    }
    this.buffer = Buffer.from(await fetch("http://download.paladium-pvp.fr/launcher/distribution.bin").then(res => res.arrayBuffer()));
    this.parse();
  }

  parse(){
    let magic = this.buffer.toString("utf8", 0, 3);
    if(magic != this.magic) return this.supported = false;
    let version = this.readByte(1);
    this.maintenance = this.readByte(1) != 0;
    if(version != this.version) return this.supported = false;
    try {
      let modules_count = this.readByte();
      for(let i = 0; i < modules_count; i++) this.modules.push(new Module(this));
      let ignored_count = this.readByte();
      for(let i = 0; i < ignored_count; i++) this.ignored.push(new Ignored(this));
    } catch(e){
      console.console.error(e);
      this.supported = false;
    }
  }

  readByte(){
    let byte = this.buffer[this.position++];
    if(!byte) byte = 0;
    return byte;
  }

  readBytes(len){
    let pos = this.position;
    this.position += len;
    return this.buffer.slice(pos, this.position);
  }

  readUInt16(){
    let pos = this.position;
    this.position += 2;
    return this.buffer.readUint16LE(pos);
  }

  readUInt32(){
    let pos = this.position;
    this.position += 4;
    return this.buffer.readUint32LE(pos);
  }

  readString(len){
    let key = this.readByte();
    let pos = this.position;
    this.position += len;
    let str = this.buffer.toString("utf8", pos, this.position);
    let string = "";
    for(let c of str.split("")) string += String.fromCharCode((c.charCodeAt() >> 4) ^ key);
    return string;
  }
}

let ModuleEnum = {
  "0": "LIBRARY",
  "1": "MOD",
  "2": "FILE"
}

let IgnoredEnum = {
  "0": "FILE",
  "1": "FOLDER"
}

class Module {
  constructor(buffer){
    this.path = buffer.readString(buffer.readUInt16());
    this.size = buffer.readUInt32();
    this.type = ModuleEnum[buffer.readByte()];
    this.crc32 = buffer.readBytes(4).toString("hex");
    this.url = buffer.readString(buffer.readUInt16());

    switch(this.type){
      case "MOD":
        this.path = `mods/${this.path}.pala`;
        break;
      case "LIBRARY":
        let split = this.path.split(":");
        this.path = `libraries/${split[0].replace(/\./g, "/")}/${split[1]}/${split[2]}/${split[1]}-${split[2]}.jar`;
    }
  }
}

class Ignored {
  constructor(buffer){
    this.path = buffer.readString(buffer.readUInt16());
    this.type = IgnoredEnum[buffer.readByte()];
  }
}

export default Distribution;
