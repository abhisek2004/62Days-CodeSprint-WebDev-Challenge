# 🎵 Moodify — Premium Web Audio Synth Player

<div align="center">

![Moodify Banner](https://img.shields.io/badge/Spotify-Style_UI-1DB954?style=for-the-badge&logo=spotify&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Enabled-1DB954?style=for-the-badge)

**A sleek, responsive, zero-dependency Spotify clone with built-in real-time synth audio generation and interactive visualizers.**

[Features](#-key-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Keyboard Shortcuts](#-keyboard-shortcuts) • [Project Structure](#-project-structure)

</div>

---

## 🚀 About the Project

**Moodify** is a modern, single-page web application inspired by Spotify's iconic UI design. Built using pure **HTML5, CSS3, and modern Vanilla JavaScript**, it features a fully functional custom synthesizer engine leveraging the browser's native **Web Audio API**.

Unlike conventional music players that rely on external static audio files (MP3/WAV), Moodify dynamically synthesizes 16 unique tracks complete with custom chord scales, arpeggios, and ambient layers in real-time.

---

## ✨ Key Features

### 🎧 Audio & Playback Engine
* **16 Web Audio Synth Tracks**: Ambient, Lo-Fi, Synthwave, Electronic, and Acoustic melodies generated live in the browser using custom musical scales.
* **Full Playback Controls**: Play, Pause, Next, Previous, Seek, Volume control, Mute/Unmute toggle.
* **Shuffle & Repeat Modes**: Built-in Fisher-Yates shuffle algorithm and single-track/playlist repeat loops.
* **3-Band Equalizer (EQ)**: Real-time frequency control (Bass, Mid, Treble) with pre-configured presets (*Flat*, *Bass+*, *Treble+*, *Vocal*).

### 🎨 Visual & Interactive Experience
* **Real-time Canvas Visualizer**: Equalizer bar animation synced with audio frequency output.
* **Vinyl Disc Animation**: Dynamic turntable rotation synced with playback status.
* **Theme Adaptability**: Background ambient gradient changes automatically based on the active track's color palette.
* **Animated Playing Indicators**: Animated green equalizer bars replacing track numbers for actively playing songs.

### 🔍 Navigation & Features
* **Multi-View Navigation**: Seamless switching between **Home** (Now Playing & Up Next queue), **Search**, and **Library**.
* **Real-Time Search & Filtering**: Instant search across titles, artists, and genres with interactive genre pills.
* **Library & History**: Organizes **Liked Songs** (persistent heart toggles) and **Recently Played** tracks.
* **Full Mobile & Touch Support**: Responsive design supporting desktop navigation, touch dragging on mobile devices, and screen adaptivity.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, Vanilla CSS3 (CSS Variables, Flexbox, Grid), JavaScript (ES6+)
* **Audio Engine**: Web Audio API (`AudioContext`, `BiquadFilterNode`, `OscillatorNode`, `GainNode`, `AnalyserNode`)
* **Typography**: Google Fonts (Inter)
* **Icons**: Inline SVG

---

## 📁 Project Structure

```text
Moodify/
├── index.html   # Main application markup & DOM structure
├── style.css    # Responsive Spotify dark theme styling
├── script.js    # Web Audio synthesis engine & UI state management
└── README.md    # Project documentation