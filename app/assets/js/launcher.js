'use strict';

// Panels
import Home from './panels/home.js';
import Account from './panels/account.js';
import Start from './panels/start.js';

// Libs
import Popup from './lib/Popup.js';
import Logger from './lib/Logger.js';
import GameManager from './lib/GameManager.js';
import Downloader from "./lib/Downloader.js";

const fs = require("fs");
const convert = require("xml-js");
const popup = new Popup();

let win = nw.Window.get();

window.isDev = (window.navigator.plugins.namedItem('Native Client') !== null);

class Launcher {
  constructor(){
    this.initWindow();
    console.log("Initializing Launcher...");
    if(localStorage.getItem("theme") == "white") document.children[0].classList.toggle("theme-white");
    else document.children[0].classList.toggle("theme-dark");
    this.createPanels(Home, Account, Start);
    if(process.platform == "win32") this.initFrame();
    this.loadMenu();
    setTimeout(() => {
      document.body.classList.remove("hide");
      this.initGame();
    }, 250);
  }

  initWindow(){
    window.logger = {
      launcher: new Logger("Launcher", "#FF7F18"),
      minecraft: new Logger("Minecraft", "#43B581")
    }

    this.initLogs();

    window.console = window.logger.launcher;

    window.onerror = (message, source, lineno, colno, error) => {
      console.error(error);
      source = source.replace(`${window.location.origin}/app/`, "");
      let stack = error.stack.replace(new RegExp(`${window.location.origin}/app/`.replace(/\//g, "\\/"), "g"), "").replace(/\n/g, "<br>").replace(/\x20/g, "&nbsp;");
      popup.showPopup("Une erreur est survenue", `
        <b>Erreur:</b> ${error.message}<br>
        <b>Fichier:</b> ${source}:${lineno}:${colno}<br>
        <b>Stacktrace:</b> ${stack}`, "warning",
        {
          value: "Relancer",
          func: () => {
            document.body.classList.add("hide");
            win.reload()
          }
        }
      );
      document.body.classList.remove("hide");
      return true;
    };

    window.onclose = () => {
      localStorage.removeItem("distribution");
    }
  }

  initLogs(){
    let logs = document.querySelector(".log-bg");

    let block = false;
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey && e.shiftKey && e.keyCode == 73 || event.keyCode == 123) && !block && !isDev) {
        logs.classList.toggle("show");
        block = true;
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.ctrlKey && e.shiftKey && e.keyCode == 73 || event.keyCode == 123) block = false;
    });

    let close = document.querySelector(".log-close");

    close.addEventListener("click", () => {
      logs.classList.toggle("show");
    })

    /* launcher logs */

    let launcher = document.querySelector("#launcher.logger");

    launcher.querySelector(".header").addEventListener("click", () => {
      launcher.classList.toggle("open");
    });

    let lcontent = launcher.querySelector(".content");

    logger.launcher.on("info", (...args) => {
      addLog(lcontent, "info", args);
    });

    logger.launcher.on("warn", (...args) => {
      addLog(lcontent, "warn", args);
    });

    logger.launcher.on("debug", (...args) => {
      addLog(lcontent, "debug", args);
    });

    logger.launcher.on("error", (...args) => {
      addLog(lcontent, "error", args);
    });

    /* minecraft logs */

    let minecraft = document.querySelector("#minecraft.logger");

    minecraft.querySelector(".header").addEventListener("click", () => {
      minecraft.classList.toggle("open");
    });

    let mcontent = minecraft.querySelector(".content");

    logger.minecraft.on("info", (...args) => {
      addLog(mcontent, "info", args);
    });

    logger.minecraft.on("warn", (...args) => {
      addLog(mcontent, "warn", args);
    });

    logger.minecraft.on("debug", (...args) => {
      addLog(mcontent, "debug", args);
    });

    logger.minecraft.on("error", (...args) => {
      addLog(mcontent, "error", args);
    });

    /* add log */

    function addLog(content, type, args){
      let final = [];
      for(let arg of args){
        if(typeof arg == "string"){
          final.push(arg);
        } else if(arg instanceof Error) {
          let stack = arg.stack.replace(new RegExp(`${window.location.origin}/app/`.replace(/\//g, "\\/"), "g"), "")
          final.push(stack);
        } else if(typeof arg == "object"){
          final.push(JSON.stringify(arg));
        } else {
          final.push(arg);
        }
      }
      let span = document.createElement("span");
      span.classList.add(type);
      span.innerHTML = `${final.join(" ")}<br>`.replace(/\x20/g, "&nbsp;").replace(/\n/g, "<br>");

      content.appendChild(span);
    }
  }

  async loadMenu(){
    let buttons = document.querySelectorAll(".panels .button");
    this.active = document.querySelector("#home.button");
    buttons.forEach(button => {
      button.addEventListener("click", () => {
        if(button.id == this.active.id) return;
        if(button.id == "settings"){
          if(this.active.parentElement.id == "stg"){
            this.active.classList.toggle("active");
            (this.active = document.querySelector("#home.button")).classList.toggle("active");
            this.changePanel("home");
          }
          return button.classList.toggle("close");
        }
        this.active.classList.toggle("active");
        (this.active = button).classList.toggle("active");
        this.changePanel(button.id);
      });
    });

    let account = document.querySelector(".account-side");
    let settings = document.querySelector("#settings");
    account.addEventListener("click", () => {
      if(settings.classList.contains("close")) settings.classList.toggle("close");
      this.active.classList.toggle("active");
      (this.active = document.querySelector("#account.button")).classList.toggle("active");
      this.changePanel("account");
    });

    /* white theme easter */
    account.addEventListener("mouseup", (e) => {
      if (e.which == 3 && e.detail == 7){
        document.children[0].classList.toggle("theme-white");
        document.children[0].classList.toggle("theme-dark");
        if(localStorage.getItem("theme") == "white") localStorage.setItem("theme", "dark");
        else localStorage.setItem("theme", "white");
      }
    });

    account.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  createPanels(...panels){
    let panelsElem = document.querySelector("#panels");
    for(let panel of panels){
      console.log(`Initializing ${panel.name} Panel...`);
      let div = document.createElement("div");
      div.id = panel.id;
      if(div.id == "home"){
        this.panel = div;
        div.classList.toggle("active");
      }
      div.innerHTML = fs.readFileSync(`app/panels/${panel.id}.html`, "utf8");
      panelsElem.appendChild(div);
      new panel().init(popup);
    }
  }

  changePanel(id){
    let panel = document.querySelector(`#panels #${id}`);
    this.panel.classList.toggle("active");
    (this.panel = panel).classList.toggle("active");
  }

  initFrame(){
    document.querySelector(".frame").classList.toggle("hide");
    document.querySelector(".dragbar").classList.toggle("hide");

    document.querySelector("#minimize").addEventListener("click", () => {
      win.minimize();
    });

    let maximized = false;
    let maximize = document.querySelector("#maximize");
    maximize.addEventListener("click", () => {
      if(maximized) win.unmaximize();
      else win.maximize();
      maximized = !maximized;
      maximize.classList.toggle("icon-maximize");
      maximize.classList.toggle("icon-restore-down");
    });

    document.querySelector("#close").addEventListener("click", () => {
      win.close();
    })
  }

  initGame(){
    this.gamemanager = new GameManager();

    this.homePlay = document.getElementById("play");
    this.homePlay.addEventListener("click", () => { this.launchGame() });

    this.sidePlay = document.getElementById("play-button");
    this.sidePlay.addEventListener("click", () => { this.launchGame() });
  }

  launch = false;
  launched = false;

  async launchGame(){
    if(this.launch) return;

    await this.gamemanager.distribution.download();

    if(this.launched)
      return popup.showPopup("Jeu déjà lancé", "Le jeu est déjà lancé", "warning", {value: "Ok"});

    if(!this.gamemanager.distribution.supported)
      return popup.showPopup("Distribution non supporté", "Votre distribution est trop veille ou non supporté", "warning", {value: "Ok"});

    if(this.gamemanager.distribution.maintenance)
      return popup.showPopup("Launcher en maintenance", "Le Launcher est en maintenance. Merci de réessayer plus tard.", "warning", {value: "Ok"});

    if(localStorage.getItem("selected") == null){
      if(settings.classList.contains("close")) settings.classList.toggle("close");
      this.active.classList.toggle("active");
      (this.active = document.querySelector("#account.button")).classList.toggle("active");
      this.changePanel("account");
      return document.querySelector(".connect-bg").classList.toggle("show");
    }

    if(parseFloat(localStorage.getItem("maxram")) < 2){
      let self = this;
      let cancel = await new Promise((resolve) => {
        popup.showPopup("Ram insuffisante", "Vous n'avez pas assez de ram allouée pour faire tourner le jeu correctement.", "warning",
          {
            value: "Annuler",
            func: () => {
              resolve(true);
            }
          },
          {
            value: "Configurer",
            func: () => {
              let setting = document.querySelector("#panels #start #memory");
              setting.classList.add("open");
              if(settings.classList.contains("close")) settings.classList.toggle("close");
              self.active.classList.toggle("active");
              (self.active = document.querySelector("#start.button")).classList.toggle("active");
              self.changePanel("start");
              resolve(true);
            }
          },
          {
            value: "Continuer",
            func: () => {
              resolve(false);
            }
          }
        );
      });
      if(cancel) return;
    }

    console.log("Launching the game");

    this.launch = true;

    this.sidePlay.classList.add("start");
    this.sidePlay.innerHTML = `<div class="progress-ring"><svg><circle cx="9" cy="9" r="9"></circle><circle cx="9" cy="9" r="9"></circle></svg></div>`;

    this.homePlay.classList.add("start");
    this.homePlay.innerHTML = `<div class="progress-ring"><svg><circle cx="9" cy="9" r="9"></circle><circle cx="9" cy="9" r="9"></circle></svg></div><span></span>`;

    let circles = [
      this.sidePlay.querySelector(".progress-ring circle:nth-child(2)"),
      this.homePlay.querySelector(".progress-ring circle:nth-child(2)")
    ]

    let span = this.homePlay.querySelector("span");
    span.innerHTML = "Vérification des assets";

    this.sidePlay.ariaLabel = "Vérification des assets";

    let circumference = 18 * Math.PI;

    for(let circle of circles){
      circle.style.strokeDasharray = `${circumference} ${circumference}`;
      circle.style.strokeDashoffset = circumference;
    }

    let setProgress = (percent) => {
      const offset = circumference - percent / 100 * circumference;
      for(let circle of circles){
        circle.style.strokeDashoffset = offset;
      }
    }

    let loading = () => {
      let side = this.sidePlay.querySelector(".progress-ring");
      let home = this.homePlay.querySelector(".progress-ring");

      let rotate = 0;

      let interval;
      setProgress(15);
      interval = setInterval(() => {
        rotate += 10;
        side.setAttribute("style", `transform: translate(-50%, -50%) rotate(${rotate}deg);`);
        home.setAttribute("style", `transform: rotate(${rotate}deg);`);
        if(rotate >= 360) rotate = 0;
      }, 25);
      return interval;
    }

    setProgress(100);
    let loadinterval = loading();

    let jsonversion = await this.gamemanager.getJSONVersion();
    let bundle = await this.gamemanager.getBundle(jsonversion);

    let todownload = await this.gamemanager.checkBundle(bundle);

    if(todownload.length > 0){
      clearInterval(loadinterval);
      this.sidePlay.classList.add("twoline");
      this.sidePlay.querySelector(".progress-ring").setAttribute("style", `transform: translate(-50%, -50%)`);
      this.homePlay.querySelector(".progress-ring").setAttribute("style", ``);

      let downloader = new Downloader();

      span.innerHTML = "<b>Téléchargement des fichiers</b> — 0%";
      this.sidePlay.ariaLabel = `Téléchargement des fichiers — 0%\n0 o/s - 0 Mo sur 0 Mo`;
      setProgress(0);

      let percent = 0;

      let size = 0;
      let totsize = this.gamemanager.getTotalSize(todownload);

      downloader.on("progress", (DL, totDL) => {
        size = DL;
        percent = Math.floor((DL/totDL) * 100);
        setProgress(percent);
        span.innerHTML = `<b>Téléchargement des fichiers</b> — ${percent}%`;
      });

      downloader.on("speed", (speed) => {
        this.sidePlay.ariaLabel = `Téléchargement des fichiers — ${percent}%\n${this.toTextSize(speed)}/s - ${Math.floor(size / 1024 / 1024)} Mo sur ${Math.floor(totsize / 1024 / 1024)} Mo`;
      });

      await new Promise((ret) => {
        downloader.on("finish", ret);

        downloader.multiple(todownload, totsize, 10);
      });

      loadinterval = loading();
    }

    this.sidePlay.classList.remove("twoline");

    await this.gamemanager.removeNonIgnoredFiles(bundle);

    span.innerHTML = "<b>Lancement du jeu</b>";
    this.sidePlay.ariaLabel = "Lancement du jeu";

    let java = await this.gamemanager.launch(bundle);

    this.launch = false;
    this.launched = true;

    let firstdata = true;
    let restore = () => {
      clearInterval(loadinterval);
      this.sidePlay.classList.remove("start");
      this.homePlay.classList.remove("start");
      this.sidePlay.innerHTML = "";
      this.sidePlay.ariaLabel = "Jouer";
      this.homePlay.innerHTML = "JOUER";
      firstdata = false;
      if(localStorage.getItem("open") != "true"){
        win.hide();
        win.setShowInTaskbar(false);
      }
    }

    let lastlog;

    java.stdout.on('data', (data) => {
      data = data.toString().trim();
      if(data.startsWith("<log4j")){
        let log4j = JSON.parse(convert.xml2json(data, {compact: true}))["log4j:Event"];
        let format = (num) => { if(String(num).length == 1){ return "0"+num } else { return num } };
        for(let log of log4j){
          let attributes = log._attributes;
          let date = new Date(parseInt(attributes.timestamp));
          let text = `[${format(date.getHours())}:${format(date.getMinutes())}:${format(date.getSeconds())}] [${attributes.thread}/${attributes.level}]: ${log["log4j:Message"]._cdata}`;
          lastlog = text;
          if(["INFO", "ALL", "OFF"].includes(attributes.level)) logger.minecraft.log(text);
          if(["DEBUG", "TRACE"].includes(attributes.level)) logger.minecraft.debug(text);
          if(attributes.level == "WARN") logger.minecraft.warn(text);
          if(["ERROR", "FATAL"].includes(attributes.level)) logger.minecraft.error(text);
          if(firstdata && log["log4j:Message"]._cdata.indexOf("Starting up SoundSystem") != -1) restore();
        }
      } else
        logger.minecraft.log(data);
    });

    let error;

    java.stderr.on('data', (data) => {
      data = data.toString().split("\n");
      data = data.slice(data, data.length-1);
      for(let err of data){
        error = err;
        logger.minecraft.error(err);
      }
    });

    java.on('close', (code) => {
      logger.minecraft.log(`Exited with code ${code}`);
      this.launched = false;
      restore();
      if(localStorage.getItem("open") != "true"){
        win.show();
        win.focus();
        win.setShowInTaskbar(true);
      }
      if(code > 0){
        if(error == undefined) error = lastlog;
        popup.showPopup("Une erreur est survenue", `<b>Erreur:</b> ${error}`, "warning", {value: "Ok"});
      }
    });
  }

  toTextSize(size){
    var sizes = ['o', 'ko', 'Mo', 'Go', 'To', 'Po', 'Eo'];

    let text;

    for(let id = 0; id < sizes.length; ++id){
      let unit = sizes[id];

      let s = Math.pow(1024, id);
      if(size >= s){
        let fixed = String((size / s).toFixed(1));
        if(fixed.indexOf('.0') === fixed.length - 2) fixed = fixed.slice(0, -2);
        text = `${fixed} ${unit}`;
      }
    }

    if (!text) text = '0 o';

    return text;
  }
}

new Launcher();
