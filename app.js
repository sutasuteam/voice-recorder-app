const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");
const list = document.getElementById("list");
const fileNameInput = document.getElementById("fileName");

// =========================
// 🔥 FIREBASE — mencatat daftar rekaman (menggantikan Supabase)
// =========================
// Pakai config Firebase yang SAMA seperti Song Writer Pro (project "song-writer-pro").
// Kalau kamu mau pisahkan jadi project Firebase sendiri, ganti nilai di bawah ini
// dengan firebaseConfig dari project barumu.

const firebaseConfig = {
  apiKey: "AIzaSyDbsnytQw6Y6QodWu2dRGkzDsakHhmlH_A",
  authDomain: "song-writer-pro.firebaseapp.com",
  projectId: "song-writer-pro",
  storageBucket: "song-writer-pro.firebasestorage.app",
  messagingSenderId: "40347373117",
  appId: "1:40347373117:web:0bd09b184210c58866a454",
  measurementId: "G-EHZWJWGF7L"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// Collection terpisah dari "songs" milik Song Writer Pro, supaya tidak tercampur.
const recordingsCollection = db.collection("recordings");

// =========================
// 🌤️ CLOUDINARY — penyimpanan file audio (menggantikan Supabase Storage)
// =========================
// Pakai akun Cloudinary & upload preset yang sama seperti Song Writer Pro.
// Kalau mau folder terpisah, buat upload preset baru di Cloudinary Console
// (Settings → Upload → Upload presets → Unsigned) lalu ganti nilai di bawah.

const CLOUDINARY_CLOUD_NAME = "y6hrjigr";
const CLOUDINARY_UPLOAD_PRESET = "song_writer_music";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

// =========================
// VARIABLES
// =========================

let mediaRecorder;
let chunks = [];

// =========================
// DOWNLOAD
// =========================
// Diambil sebagai blob dulu (bukan langsung href) supaya browser benar-benar
// mendownload filenya, bukan cuma membuka di tab baru — karena file sekarang
// datang dari domain lain (Cloudinary), bukan lagi dari domain Supabase.

window.downloadFile = async function(url, fileName) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error(err);
        alert("Gagal download: " + err.message);
    }
};

// =========================
// DELETE
// =========================
// Catatan: ini menghapus rekaman dari DAFTAR (Firestore) saja.
// File audio aslinya tetap tersimpan di Cloudinary (tidak masalah — gratis,
// tidak kena biaya). Kalau nanti perlu hapus permanen dari Cloudinary juga,
// itu butuh sedikit kode tambahan di backend (API secret tidak boleh
// ditaruh di browser).

window.deleteFile = async function(id) {

    const ok = confirm("Hapus rekaman ini dari daftar?");
    if (!ok) return;

    try {
        await recordingsCollection.doc(id).delete();
    } catch (error) {
        alert(error.message);
        return;
    }

    loadFiles();
};

// =========================
// LOAD FILES — dari Firestore (bukan lagi list storage Supabase)
// =========================

async function loadFiles() {

    list.innerHTML = "Loading...";

    try {
        const snapshot = await recordingsCollection.orderBy("createdAt", "desc").get();

        if (snapshot.empty) {
            list.innerHTML = "<div class='empty-state'>Belum ada rekaman</div>";
            return;
        }

        list.innerHTML = "";

        snapshot.forEach(doc => {

            const data = doc.data();
            const id = doc.id;

            const row = document.createElement("div");

            row.innerHTML = `
            <div class="audio-card">
            
                <div class="audio-info">
            
                    <div class="audio-name">
                        🎵 ${data.name}
                    </div>
            
                    <audio controls src="${data.url}"></audio>
            
                </div>
            
                <div class="audio-actions">
            
                    <button class="download-btn"
                        onclick="downloadFile('${data.url}', '${data.name}')">
                        <i class="fa-solid fa-download"></i>
                    </button>
            
                    <button class="delete-btn"
                        onclick="deleteFile('${id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
            
                    <button class="open-btn"
                        onclick="window.location.href='player.html?file=${encodeURIComponent(data.url)}'">
                        🎧
                    </button>
            
                </div>
            
            </div>
            `;

            list.appendChild(row);
        });

    } catch (error) {
        console.error("FIRESTORE ERROR:", error);
        list.innerHTML = "❌ Gagal load file";
    }
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
// STOP + UPLOAD ke Cloudinary, lalu catat ke Firestore
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

            status.textContent = "⏳ Mengunggah...";

            const formData = new FormData();
            formData.append("file", blob, finalName);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
            formData.append("resource_type", "video"); // Cloudinary memperlakukan audio di bawah kategori "video"

            const response = await fetch(CLOUDINARY_UPLOAD_URL, {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Upload ke Cloudinary gagal");
            }

            await recordingsCollection.add({
                name: finalName,
                url: data.secure_url,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

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
// INIT
// =========================

document.addEventListener("DOMContentLoaded", () => {
    loadFiles();
});
