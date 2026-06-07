const SUPABASE_URL = "https://btajgtzfoyadcnqfgjsg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0YWpndHpmb3lhZGNucWZnanNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTQ3NzEsImV4cCI6MjA5NTMzMDc3MX0.kD81Imzw3NQ_ZTgj5nRPrKfh7Ong7Zmwt7I7WeyeM5M";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("status");
const list = document.getElementById("list");

let mediaRecorder;
let chunks = [];

// 🎙 START RECORD
startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 1.5;

  const dest = audioContext.createMediaStreamDestination();

  source.connect(gainNode);
  gainNode.connect(dest);

  mediaRecorder = new MediaRecorder(dest.stream);

  mediaRecorder.ondataavailable = e => chunks.push(e.data);

  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: "audio/webm" });
    chunks = [];

    await upload(blob);
    loadFiles();
  };

  mediaRecorder.start();

  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusText.innerText = "Recording...";
};

// ⏹ STOP RECORD
stopBtn.onclick = () => {
  mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusText.innerText = "Saving...";
};

// ☁️ UPLOAD SUPABASE
async function upload(blob) {
  const fileName = `audio-${Date.now()}.webm`;

  const { error } = await supabaseClient.storage
    .from("recordings")
    .upload(fileName, blob);

  if (error) {
    console.log(error);
    statusText.innerText = "Upload gagal";
  } else {
    statusText.innerText = "Upload sukses ✔";
  }
}

// 📋 LOAD LIST FILE
async function loadFiles() {
  const { data, error } = await supabaseClient.storage
    .from("recordings")
    .list();

  if (error) return console.log(error);

  list.innerHTML = "";

  data.forEach(file => {
    const { data: urlData } = supabaseClient.storage
      .from("recordings")
      .getPublicUrl(file.name);

    const row = document.createElement("tr");

    window.renameAndDownload = (url, oldName) => {
      let newName = prompt("Rename file sebelum download:", oldName);
    
      if (!newName) return;
    
      // pastikan ada ekstensi .webm
      if (!newName.endsWith(".webm")) {
        newName += ".webm";
      }
    
      const a = document.createElement("a");
      a.href = url;
      a.download = newName;
    
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    list.appendChild(row);
  });
}

// ▶ PLAY
window.playAudio = (url) => {
  const audio = new Audio(url);
  audio.play();
};

// 🗑 DELETE
window.deleteFile = async (name) => {
  await supabaseClient.storage
    .from("recordings")
    .remove([name]);

  loadFiles();
};

// 🔄 AUTO LOAD
loadFiles();