'use strict';

import Slider from '../lib/Slider.js';
const { execSync } = require('child_process');

const os = require("os");

class Start {
  static id = "start"

  init(popup){
    this.popup = popup;

    this.initBoxes();

    this.initMemory();
    this.initJava();
    this.initResolution();
    this.initOpen();
  }

  initBoxes(){
    document.querySelector("#panels #start").addEventListener("click", (event) => {
      if(event.target.classList.contains("header")) event.path[1].classList.toggle("open");
    });
  }

  async initMemory(){
    console.log("[Start] Initializing Memory Setting...");

    await new Promise(function(resolve, reject) {
      let interval;
      interval = setInterval(() => {
        let slider = document.getElementById("memory-slider");
        if(slider.offsetWidth < 1130) resolve(clearInterval(interval));
      }, 100);
    });

    if(localStorage.getItem("minram") == null) localStorage.setItem("minram", 0.5);
    if(localStorage.getItem("maxram") == null) localStorage.setItem("maxram", 2);

    let totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
    let freeMem = Math.trunc(os.freemem() / 1073741824 * 10) / 10;
    if(process.platform == "darwin"){
      let freemem = () => {
        try {
          let out = execSync("vm_stat | awk '/free/ {gsub(/\\./, \"\", $3); print $3}'").toString().split("\n");
          if(out[0] == void 0 || out[0] === "" || (out = parseInt(out[0])) == NaN) return os.freemem();
          out *= 4096;
          return out;
        } catch(e) {
          return os.freemem();
        }
      }
      freeMem = Math.trunc(freemem() / 1073741824 * 10) / 10;
    } else if(process.platform == "linux"){
      totalMem = Math.trunc(os.totalmem() / 1000000000 * 10) / 10;
      freeMem = Math.trunc(os.freemem() / 1000000000 * 10) / 10;
    }

    document.getElementById("total-ram").textContent = `${totalMem} Go`;
    document.getElementById("free-ram").textContent = `${freeMem} Go`;

    if(freeMem >= Math.trunc(freeMem) + 0.5) freeMem = Math.trunc(freeMem) + 0.5;
    else if(freeMem >= Math.trunc(freeMem)) freeMem = Math.trunc(freeMem);

    if(totalMem >= Math.trunc(totalMem) + 0.5) totalMem = Math.trunc(totalMem) + 0.5;
    else if(totalMem >= Math.trunc(totalMem)) totalMem = Math.trunc(totalMem);

    if(totalMem > 8) totalMem = 8;

    if(parseFloat(localStorage.getItem("maxram")) > totalMem) if(totalMem - 0.5 > 0) localStorage.setItem("maxram", totalMem - 0.5);


    let sliderDiv = document.getElementById("memory-slider");
    sliderDiv.setAttribute("max", totalMem);

    let slider = new Slider("memory-slider", parseFloat(localStorage.getItem("minram")), parseFloat(localStorage.getItem("maxram")));

    let minSpan = document.querySelector("#memory-slider .slider-touch-left span");
    let maxSpan = document.querySelector("#memory-slider .slider-touch-right span");

    minSpan.setAttribute("value", `${localStorage.getItem("minram")} Go`);
    maxSpan.setAttribute("value", `${localStorage.getItem("maxram")} Go`);

    slider.on("change", (min, max) => {
      minSpan.setAttribute("value", `${min} Go`);
      maxSpan.setAttribute("value", `${max} Go`);
      localStorage.setItem("minram", min);
      localStorage.setItem("maxram", max);
    });

    document.getElementById("memory").classList.toggle("open");
  }

  initJava(){
    console.log("[Start] Initializing Java Setting...");

    document.querySelector("#info-path").textContent = `${localStorage.getItem(".paladium")}/runtime/java`;

    let path = document.querySelector("#path");
    path.value = localStorage.getItem("java").replace(/\\/g, "/");
    let file = document.querySelector("#path-file");

    document.querySelector(".path-button").addEventListener("click", async () => {
      file.value = "";
      file.click();
      await new Promise((resolve) => {
        let interval;
        interval = setInterval(() => {
          if(file.value != "") resolve(clearInterval(interval));
        }, 100);
      });

      if(file.value.replace(".exe", "").endsWith("java") || file.value.replace(".exe", "").endsWith("javaw")){
        localStorage.setItem("java", file.value);
        path.value = file.value.replace(/\\/g, "/");
      } else this.popup.showPopup("Nom de fichier incorrect", "Le nom du fichier doit être java ou javaw", "warning", {value: "OK"});
    });
  }

  initResolution(){
    console.log("[Start] Initializing Resolution Setting...");

    if(localStorage.getItem("fullscreen") == null) localStorage.setItem("fullscreen", false);
    if(localStorage.getItem("width") == null) localStorage.setItem("width", 1280);
    if(localStorage.getItem("height") == null) localStorage.setItem("height", 720);

    let fullscreen = document.getElementById("checkbox_fullscreen");
    fullscreen.checked = localStorage.getItem("fullscreen") == "true";
    fullscreen.addEventListener("change", (event) => {
      localStorage.setItem("fullscreen", fullscreen.checked);
    });

    let width = document.getElementById("width");
    width.value = localStorage.getItem("width");
    width.addEventListener("input", (event) => {
      if(isNaN(Number(width.value)) || width.value.startsWith("-")) return width.value = localStorage.getItem("width");
      localStorage.setItem("width", width.value);
    });

    let height = document.getElementById("height");
    height.value = localStorage.getItem("height");
    height.addEventListener("input", (event) => {
      if(isNaN(Number(height.value)) || height.value.startsWith("-")) return height.value = localStorage.getItem("height");
      localStorage.setItem("height", height.value);
    });

    let select = document.getElementById("select");
    select.addEventListener("change", (event) => {
      let resolution = select.options[select.options.selectedIndex].value.split(" x ");
      select.options.selectedIndex = 0;

      width.value = resolution[0];
      height.value = resolution[1];
      localStorage.setItem("width",  resolution[0]);
      localStorage.setItem("height", resolution[1]);
    });
  }

  initOpen(){
    console.log("[Start] Initializing Open Setting...");

    if(localStorage.getItem("open") == null) localStorage.setItem("open", true);

    let open = document.getElementById("checkbox_open");
    let close = document.getElementById("checkbox_close");

    if(localStorage.getItem("open") == "true") open.checked = true;
    else close.checked = true;

    open.addEventListener("change", (event) => {
      if(!open.checked) open.checked = true;
      close.checked = false;
      localStorage.setItem("open", true);
    });

    close.addEventListener("change", (event) => {
      if(!close.checked) close.checked = true;
      open.checked = false;
      localStorage.setItem("open", false);
    });
  }
}

export default Start;
