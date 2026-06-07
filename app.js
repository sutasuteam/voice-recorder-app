const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");
const list = document.getElementById("list");
const fileNameInput = document.getElementById("fileName");

// =========================
// SUPABASE
// =========================

const SUPABASE_URL = "https://btajgtzfoyadcnqfgjsg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0YWpndHpmb3lhZGNucWZnanNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTQ3NzEsImV4cCI6MjA5NTMzMDc3MX0.kD81Imzw3NQ_ZTgj5nRPrKfh7Ong7Zmwt7I7WeyeM5M";

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
// DOWNLOAD
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
// DELETE
// =========================

window.deleteFile = async function(fileName) {

    const ok = confirm("Hapus file ini?");
    if (!ok) return;

    const { error } = await supabaseClient.storage
        .from("recordings")
        .remove([fileName]);

    if (error) {
        alert(error.message);
        return;
    }

    loadFiles();
};

// =========================
// LOAD FILES (FIXED)
// =========================

async function loadFiles() {

    list.innerHTML = "Loading...";

    const { data, error } = await supabaseClient.storage
        .from("recordings")
        .list();

    if (error) {
        console.error("SUPABASE ERROR:", error);
        list.innerHTML = "❌ Gagal load file";
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = "<div class='empty-state'>Belum ada rekaman</div>";
        return;
    }

    list.innerHTML = "";

    data.forEach(file => {

        const { data: publicData } =
            supabaseClient.storage
                .from("recordings")
                .getPublicUrl(file.name);

        const row = document.createElement("div");

        row.innerHTML = `
        <div class="audio-card">
        
            <div class="audio-info">
        
                <div class="audio-name">
                    🎵 ${file.name}
                </div>
        
                <audio controls src="${publicData.publicUrl}"></audio>
        
            </div>
        
            <div class="audio-actions">
        

        
                <button class="delete-btn"
                    onclick="deleteFile('${file.name}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
        
                <button class="open-btn"
                    onclick="window.location.href='player.html?file=${publicData.publicUrl}'">
                    🎧
                </button>
        
            </div>
        
        </div>
        `;

        list.appendChild(row);
    });
}

// =========================
// RECORDING
// =========================

startBtn.onclick = async () => {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        mediaRecorder = new MediaRecorder(stream);
        chunks = [];

        mediaRecorder.ondataavailable = e => {
            chunks.push(e.data);
        };

        mediaRecorder.start();

        status.textContent = "🎙 Sedang merekam...";
        startBtn.disabled = true;
        stopBtn.disabled = false;

    } catch (err) {
        console.error(err);
        status.textContent = "❌ Mikrofon tidak bisa diakses";
    }
};

// =========================
// STOP + UPLOAD
// =========================

stopBtn.onclick = () => {

    if (!mediaRecorder) return;

    mediaRecorder.stop();

    mediaRecorder.onstop = async () => {

        try {

            const blob = new Blob(chunks, {
                type: "audio/webm"
            });

            let name = fileNameInput.value.trim();
            if (!name) name = "recording_" + Date.now();

            const finalName = name + ".webm";

            const { error } = await supabaseClient.storage
                .from("recordings")
                .upload(finalName, blob, {
                    contentType: "audio/webm",
                    upsert: true
                });

            if (error) throw error;

            status.textContent = "✅ Upload selesai";

            fileNameInput.value = "";

            loadFiles();

        } catch (err) {
            console.error(err);
            status.textContent = "❌ " + err.message;
        }
    };

    startBtn.disabled = false;
    stopBtn.disabled = true;
};

// =========================
// INIT (IMPORTANT FIX)
// =========================

document.addEventListener("DOMContentLoaded", () => {
    loadFiles();
});