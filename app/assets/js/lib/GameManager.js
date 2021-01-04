'use strict';

import Distribution from "./Distribution.js";
import AccDatabase from './AccDatabase.js';

const os = require("os");
const fs = require("fs");
const { spawn, execSync } = require("child_process");
const AdmZip = require('adm-zip');

let MojangLib = {win32: "windows", darwin: "osx", linux: "linux"};
let Arch = {x32: "32", x64: "64", arm: "32", arm64: "64"};

class GameManager {
  constructor(){
    this.distribution = new Distribution();
    this.accounts = new AccDatabase();
    this.accounts.init();
    this.hash = new Worker("assets/js/lib/workers/Hash.js");
  }

  getTotalSize(bundle){
    let size = 0;
    for(let file of bundle){
      size += file.size;
    }
    return size;
  }

  async getJSONVersion(){
    let jsonversion = (await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json").then(res => res.json())).versions.find(ver => ver.id == "1.7.10");
    return await fetch(jsonversion.url).then(res => res.json());
  }

  async getBundle(jsonversion){
    let libraries = await this.getAllLibrairies(jsonversion);

    let assets = await this.getAllAssets(jsonversion);
    let assetsjson = {
      path: `assets/indexes/1.7.10.json`,
      type: "CFILE",
      content: JSON.stringify(assets.json)
    }
    assets = assets.assets;

    let clientjar = jsonversion.downloads.client;
    assets.push({
      sha1: clientjar.sha1,
      size: clientjar.size,
      path: `versions/1.7.10/1.7.10.jar`,
      type: "LIBRARY",
      url: clientjar.url
    });

    let logging = jsonversion.logging.client.file;
    assets.push({
      sha1: logging.sha1,
      size: logging.size,
      path: `assets/log_configs/${logging.id}`,
      type: "LOG",
      url: logging.url
    });

    return [assetsjson].concat(libraries).concat(assets).concat(this.distribution.modules);
  }

  async checkBundle(bundle){
    let todownload = [];
    for (let file of bundle){
      if(file.path.indexOf(localStorage.getItem(".paladium")) == -1){
        file.path = `${localStorage.getItem(".paladium").replace(/\\/g, "/")}/${file.path}`;
      }
      file.folder = file.path.split("/").slice(0, -1).join("/");
      if(file.type == "CFILE"){
        if(!fs.existsSync(file.folder)) fs.mkdirSync(file.folder, { recursive: true, mode: 0o777 });
        fs.writeFileSync(file.path, file.content, { encoding: "utf8", mode: 0o755 });
        continue;
      }
      console.log(`Verifying ${file.path} file`);
      if(fs.existsSync(file.path)){
        if(file.crc32){
          if(!(await this.checkCRC32(file.path, file.crc32))) todownload.push(file);
        } else {
          if(!(await this.checkSHA1(file.path, file.sha1))) todownload.push(file);
        }
      } else todownload.push(file);
    }
    return todownload;
  }

  async getAllLibrairies(jsonversion){
    let libraries = [];
    for(let lib of jsonversion.libraries){
      let artifact;
      let type = "LIBRARY"
      if(lib.natives){
        let classifiers = lib.downloads.classifiers;
        let native = lib.natives[MojangLib[process.platform]];
        if(!native) native = lib.natives[process.platform];
        type = "NATIVE";
        if(native) artifact = classifiers[native.replace("${arch}", Arch[os.arch()])];
        else continue;
      } else {
        artifact = lib.downloads.artifact;
        if(artifact.path == "com/google/guava/guava/15.0/guava-15.0.jar") continue;
      }
      if(!artifact) continue;
      libraries.push({
        sha1: artifact.sha1,
        size: artifact.size,
        path: `libraries/${artifact.path}`,
        type: type,
        url: artifact.url
      });
    }
    return libraries;
  }

  async getAllAssets(jsonversion){
    let assetsjson = await fetch(jsonversion.assetIndex.url).then(res => res.json());
    let assets = [];
    for(let asset of Object.values(assetsjson.objects)){
      assets.push({
        sha1: asset.hash,
        size: asset.size,
        type: "FILE",
        path: `assets/objects/${asset.hash.substring(0, 2)}/${asset.hash}`,
        url: `https://resources.download.minecraft.net/${asset.hash.substring(0, 2)}/${asset.hash}`
      });
    }
    return {json: assetsjson, assets};
  }

  async checkSHA1(file, hash){
    let sha1 = await this.getDigest("SHA1", fs.readFileSync(file));
    if(sha1 != hash.toLowerCase()) return false;
    return true;
  }

  async checkCRC32(file, hash){
    let crc32 = await this.getDigest("CRC32", fs.readFileSync(file));
    if(crc32 != hash.toLowerCase()) return false;
    return true;
  }

  async getDigest(hash, data){
    return new Promise((resolve) => {
      let message = (e) => {
        this.hash.removeEventListener('message', message);
        resolve(e.data);
      }

      this.hash.addEventListener('message', message);

      this.hash.postMessage({hash, data});
    });
  }

  async removeNonIgnoredFiles(bundle){
    let files = this.getFiles(localStorage.getItem(".paladium")).filter(file => !file.startsWith(`${localStorage.getItem(".paladium")}/runtime`));

    for(let ignored of this.distribution.ignored){
      let path = `${localStorage.getItem(".paladium")}/${ignored.path}`;
      if(ignored.type == "FILE"){
        files = files.filter(file => file != path);
      } else if(ignored.type == "FOLDER"){
        files = files.filter(file => !file.startsWith(path));
      }
    }

    for(let mod of bundle){
      files = files.filter(file => file != mod.path);
    }

    for(let file of files){
      try {
        if(fs.statSync(file).isDirectory()){
          fs.rmdirSync(file);
        } else {
          fs.unlinkSync(file);
          let folder = file.split("/").slice(0, -1).join("/");
          while(true){
            if(folder == localStorage.getItem(".paladium")) break;
            let content = fs.readdirSync(folder);
            if(content.length == 0) fs.rmdirSync(folder);
            folder = folder.split("/").slice(0, -1).join("/");
          }
        }
      } catch(e){ }
    }
  }

  getFiles(path, filesArr = []){
    if(fs.existsSync(path)){
      let files = fs.readdirSync(path);
      if(files.length == 0) filesArr.push(path);
      for(let i in files){
        let name = `${path}/${files[i]}`;
        if(fs.statSync(name).isDirectory())
          this.getFiles(name, filesArr);
        else
          filesArr.push(name);
      }
    }
    return filesArr;
  }

  async launch(bundle){
    let libraries = bundle.filter(mod => mod.type == "LIBRARY").map(mod => mod.path);
    if(process.platform == "win32") libraries = libraries.join(";");
    else libraries = libraries.join(":");
    let logger = bundle.find(mod => mod.type == "LOG").path;

    let natives = bundle.filter(mod => mod.type == "NATIVE").map(mod => mod.path);
    let nativeFolder = `${localStorage.getItem(".paladium")}/versions/1.7.10/natives`;
    if(!fs.existsSync(nativeFolder)) fs.mkdirSync(nativeFolder, { recursive: true, mode: 0o777 });

    for(let native of natives){
      console.log(`Extracting native ${native}`);
      let zip = new AdmZip(native);
      let entries = zip.getEntries();
      for(let entry of entries){
        if(entry.entryName.startsWith("META-INF")) continue;
        fs.writeFileSync(`${nativeFolder}/${entry.entryName}`, entry.getData(), { encoding: "utf8", mode: 0o755 });
        if(process.platform == "darwin" && (`${nativeFolder}/${entry.entryName}`.endsWith(".dylib") || `${nativeFolder}/${entry.entryName}`.endsWith(".jnilib"))){
          console.log(`Whitelisting from Apple Quarantine ${`${nativeFolder}/${entry.entryName}`}`);
          let id = String.fromCharCode.apply(null, execSync(`xattr -p com.apple.quarantine "${`${nativeFolder}/${entry.entryName}`}"`));
          execSync(`xattr -w com.apple.quarantine "${id.replace("0081;", "00c1;")}" "${`${nativeFolder}/${entry.entryName}`}"`);
        }
      }
    }

    let args = await this.initArgs(libraries, logger);

    return spawn(localStorage.getItem("java"), args, { cwd: localStorage.getItem(".paladium"), detached: true });
  }

  async initArgs(libs, logger){
    let account = await this.accounts.get(localStorage.getItem("selected"));

    let args = [
      "-cp",
      libs,
      `-Xms${parseFloat(localStorage.getItem("minram")) * 1024}M`,
      `-Xmx${parseFloat(localStorage.getItem("maxram")) * 1024}M`,
      /* custom args */
      "-XX:+UnlockExperimentalVMOptions",
      "-XX:+UseG1GC",
      "-XX:G1NewSizePercent=20",
      "-XX:G1ReservePercent=20",
      "-XX:MaxGCPauseMillis=50",
      "-XX:G1HeapRegionSize=32M",
      "-Xmn128M",
      /* ends */
      `-Djava.library.path=${localStorage.getItem(".paladium")}/versions/1.7.10/natives`,
      `-Dlog4j.configurationFile=${logger}`,
      "net.minecraft.launchwrapper.Launch",
      "--username",
      account.username,
      "--version",
      "1.7.10",
      "--gameDir",
      localStorage.getItem(".paladium"),
      "--assetsDir",
      `${localStorage.getItem(".paladium")}/assets`,
      "--assetIndex",
      "1.7.10",
      "--uuid",
      account.uuid,
      "--accessToken",
      account.token,
      "--userProperties",
      "{}",
      "--userType",
      account.type == "mojang" ? "mojang" : "msa",
      "--tweakClass",
      "cpw.mods.fml.common.launcher.FMLTweaker"
    ];

    if(localStorage.getItem("fullscreen") == "true"){
      args.push(...["--fullscreen", "true"]);
    } else {
      args.push(...[
        "--width",
        localStorage.getItem("width"),
        "--height",
        localStorage.getItem("height")
      ]);
    }

    return args;
  }
}

export default GameManager;
