const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_KEY = "YOUR_ANON_KEY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("status");
const audioPlayback = document.getElementById("audioPlayback");

let mediaRecorder;
let chunks = [];

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

    audioPlayback.src = URL.createObjectURL(blob);

    await upload(blob);
  };

  mediaRecorder.start();

  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusText.innerText = "Recording...";
};

stopBtn.onclick = () => {
  mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusText.innerText = "Uploading...";
};

async function upload(blob) {
  const fileName = `audio-${Date.now()}.webm`;

  const { error } = await supabaseClient.storage
    .from("recordings")
    .upload(fileName, blob);

  if (error) {
    statusText.innerText = "Upload gagal";
    console.log(error);
  } else {
    statusText.innerText = "Upload sukses ✔";
  }
}