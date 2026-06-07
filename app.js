const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");
const list = document.getElementById("list");
const fileNameInput = document.getElementById("fileName");

// =========================
// SUPABASE
// =========================

const SUPABASE_URL =
"https://btajgtzfoyadcnqfgjsg.supabase.co";

const SUPABASE_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0YWpndHpmb3lhZGNucWZnanNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTQ3NzEsImV4cCI6MjA5NTMzMDc3MX0.kD81Imzw3NQ_ZTgj5nRPrKfh7Ong7Zmwt7I7WeyeM5M";
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// =========================
// VARIABLES
// =========================

let mediaRecorder;
let chunks = [];

// =========================
// DOWNLOAD FILE
// =========================

window.downloadFile = function(url, fileName) {

    const a = document.createElement("a");

    a.href = url;
    a.download = fileName;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);
};

// =========================
// DELETE FILE
// =========================

window.deleteFile = async function(fileName) {

    const ok = confirm(
        "Hapus file ini?"
    );

    if (!ok) return;

    const { error } =
    await supabaseClient.storage
    .from("recordings")
    .remove([fileName]);

    if (error) {
        alert(error.message);
        return;
    }

    loadFiles();
};

// =========================
// LOAD FILES
// =========================

async function loadFiles() {

    list.innerHTML = "";

    const { data, error } =
    await supabaseClient.storage
    .from("recordings")
    .list();

    if (error) {
        console.error(error);
        return;
    }

    data.forEach(file => {

        const { data: publicData } =
        supabaseClient.storage
        .from("recordings")
        .getPublicUrl(file.name);

        const row =
        document.createElement("tr");

        row.innerHTML = `
            <td>${file.name}</td>

            <td>
                <audio
                    controls
                    src="${publicData.publicUrl}">
                </audio>
            </td>

            <td>
                <button onclick="downloadFile('${publicData.publicUrl}','${file.name}')">
                    ⬇ Download
                </button>

                <button onclick="deleteFile('${file.name}')">
                    🗑 Delete
                </button>
            </td>
        `;

        list.appendChild(row);
    });
}

// =========================
// START RECORDING
// =========================

startBtn.onclick = async () => {

    try {

        const stream =
        await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        mediaRecorder =
        new MediaRecorder(stream);

        chunks = [];

        mediaRecorder.ondataavailable = e => {
            chunks.push(e.data);
        };

        mediaRecorder.start();

        status.textContent =
        "🎙 Sedang merekam...";

        startBtn.disabled = true;
        stopBtn.disabled = false;

    } catch(err) {

        console.error(err);

        status.textContent =
        "❌ Gagal mengakses mikrofon";
    }
};

// =========================
// STOP RECORDING
// =========================

stopBtn.onclick = () => {

    if (!mediaRecorder) return;

    mediaRecorder.stop();

    mediaRecorder.onstop = async () => {

        try {

            status.textContent =
            "☁️ Upload ke Supabase...";

            const webmBlob =
            new Blob(chunks, {
                type: "audio/webm"
            });
            
            status.textContent =
            "⏳ Mengkonversi ke MP3...";
            
            const mp3Blob =
            await convertToMp3(webmBlob);

            let fileName =
            fileNameInput?.value.trim();

            if (!fileName) {
                fileName =
                "recording_" + Date.now();
            }

            const finalName =
            fileName + ".mp3";

            const { error } =
            await supabaseClient.storage
            .from("recordings")
            .upload(
              finalName,
              mp3Blob,
                {
                  contentType: "audio/mpeg",
                }
            );

            if (error)
                throw error;

            status.textContent =
            "✅ Upload selesai";

            if (fileNameInput) {
                fileNameInput.value = "";
            }

            loadFiles();

        } catch(err) {

            console.error(err);

            status.textContent =
            "❌ " + err.message;
        }
    };

    startBtn.disabled = false;
    stopBtn.disabled = true;
};


// =========================
// CONVERT WEBM TO MP3
// =========================

async function convertToMp3(webmBlob){

  const {
      FFmpeg
  } = FFmpegWASM;

  const ffmpeg =
      new FFmpeg();

  await ffmpeg.load();

  const inputData =
      new Uint8Array(
          await webmBlob.arrayBuffer()
      );

  await ffmpeg.writeFile(
      "input.webm",
      inputData
  );

  await ffmpeg.exec([
      "-i",
      "input.webm",
      "-vn",
      "-ar","44100",
      "-ac","2",
      "-b:a","192k",
      "output.mp3"
  ]);

  const output =
      await ffmpeg.readFile(
          "output.mp3"
      );

  return new Blob(
      [output.buffer],
      {
          type:"audio/mpeg"
      }
  );
}


// =========================
// INIT
// =========================

loadFiles();