# 💱 Global Currency Converter

<div align="center">

![Glassmorphism UI](https://img.shields.io/badge/UI-Glassmorphism-4f46e5?style=for-the-badge)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![API](https://img.shields.io/badge/REST_API-Live_Rates-0ea5e9?style=for-the-badge)

**A sleek, responsive, and dynamic real-time currency converter utilizing live exchange rates.**

[Features](#-key-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Project Structure](#-project-structure)

</div>

---

## 🚀 About the Project

The **Global Currency Converter** is a modern, single-page web application that allows users to instantly convert between 160+ global currencies. It fetches live, up-to-date exchange rates using a free REST API and presents data through a stunning, world-class "Glassmorphism" user interface.

Instead of relying on heavy image assets for flags, the application intelligently renders native high-quality Emoji flags on-the-fly, utilizing ISO country codes and native JavaScript `Intl` APIs for flawless localization and currency formatting.

---

## ✨ Key Features

### 💻 World-Class UI / UX
* **Glassmorphism Design**: Beautiful frosted-glass cards layered over an animated, multi-colored blob mesh background.
* **Custom Dropdowns**: Fully custom-built currency selectors featuring an integrated search bar to instantly find any currency.
* **Fluid Animations**: Smooth hover states, transition effects, and a rotating swap button.

### ⚙️ Engine & Logic
* **Live Exchange Rates**: Fetches real-time, accurate financial data directly from [ExchangeRate-API](https://www.exchangerate-api.com/).
* **Native JavaScript `Intl` API**: Leverages the browser's built-in Internationalization API to dynamically resolve correct currency names (e.g., "US Dollar") and symbols (e.g., "$", "€", "¥") without hardcoding.
* **Zero Image Assets**: Dynamically computes and renders native OS Emoji flags mathematically based on 2-letter currency ISO codes.

---

## 🛠️ Tech Stack

* **Frontend Structure**: HTML5
* **Styling & Animations**: Pure Vanilla CSS3 (Flexbox, CSS Variables, Keyframes, Backdrop Filters)
* **Application Logic**: Vanilla JavaScript (ES6+, Async/Await, Fetch API)
* **Data Source**: [Open Exchange Rates API](https://open.er-api.com) (No API Key Required)
* **Typography**: Google Fonts (Outfit)

---

## 📁 Project Structure

```text
Currency-Converter/
├── index.html   # Main application markup & DOM structure
├── style.css    # Animated background & glassmorphic styling
├── script.js    # API fetching, custom dropdown logic & calculations
└── README.md    # Project documentation