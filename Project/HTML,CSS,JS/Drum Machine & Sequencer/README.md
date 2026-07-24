# 🎛️ NEQ-808 Pro Rhythm Synthesizer

<div align="center">

![Neumorphism UI](https://img.shields.io/badge/UI-Neumorphism-2b2d31?style=for-the-badge)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Enabled-1DB954?style=for-the-badge)

**A professional, fully-functional 16-step drum machine featuring real-time Web Audio synthesis and a stunning dark-metallic Neumorphic interface.**

[Features](#-key-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Project Structure](#-project-structure)

</div>

---

## 🚀 About the Project

The **NEQ-808 Pro** is a browser-based drum sequencer inspired by legendary vintage hardware (like the Roland TR-808). Built entirely with Vanilla web technologies, it requires no external audio samples. Instead, it mathematically synthesizes 7 distinct drum sounds in real-time using the browser's native **Web Audio API**.

The interface utilizes an ultra-premium **Neumorphic (Skeuomorphic)** design system. Through meticulously calculated CSS gradients, inset shadows, and glowing neon indicators, the UI mimics the tactile depth and realism of physical studio hardware.

---

## ✨ Key Features

### 🎧 Audio Synthesis Engine
* **Zero External Samples**: All sounds (Kick, Snare, Clap, Hi-Hats, Tom, Cowbell) are generated on the fly using `AudioContext` oscillators, white noise buffers, and Biquad filters.
* **Rock-Solid Timing**: Utilizes a professional lookahead scheduling algorithm synced to the audio clock, eliminating the lag and drift caused by standard `setInterval` timers.
* **Humanized Swing/Shuffle**: A dynamic swing slider that mathematically delays offbeat steps, injecting realistic groove into rigid robotic beats.

### 🎨 Premium Neumorphic UI
* **Photorealistic Depth**: Multi-directional metallic gradients combined with precise drop-shadows create raised and recessed hardware buttons.
* **Neon LED Indicators**: Glowing colored track dots and step LEDs that pulse in perfect synchronization with the audio engine.
* **Responsive Layout**: Clean, organized 16-step grid layout logically grouped into 4-beat chunks for intuitive sequencing.

### 🎚️ Workflow Controls
* **Instant Presets**: Quickly load built-in grooves for House, Techno, and Hip-Hop.
* **Master Controls**: Real-time tempo adjustment (60–200 BPM) and master volume leveling.
* **Clear Board**: A single click wipes the sequence to start fresh.

---

## 🛠️ Tech Stack

* **Frontend Structure**: HTML5
* **Styling & 3D Depth**: Pure Vanilla CSS3 (Custom Properties, Gradients, Complex Box-Shadows)
* **Application Logic & UI Sync**: Vanilla JavaScript (ES6+, DOM Manipulation, `requestAnimationFrame`)
* **Audio Engine**: JavaScript Web Audio API (`AudioContext`, `OscillatorNode`, `BiquadFilterNode`, `GainNode`)
* **Typography**: Google Fonts (Orbitron for digital displays, Inter for labels)

---

## 📁 Project Structure

```text
NEQ-808/
├── index.html   # Main application markup & sequencer layout
├── style.css    # Neumorphic styling, metallic gradients, and neon LEDs
├── script.js    # Audio synthesis, lookahead scheduler, and UI logic
└── README.md    # Project documentation